const pool = require('../config/db');

exports.createIssue = async (req, res) => {
    const { title, description, category, latitude, longitude } = req.body;
    const reporter_id = req.session.user.id;
    const image_path = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const newIssue = await pool.query(
            "INSERT INTO issues (title, description, category, latitude, longitude, image_path, reporter_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
            [title, description, category, latitude, longitude, image_path, reporter_id]
        );
        res.status(201).json(newIssue.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Server error while creating issue." });
    }
};

exports.getIssues = async (req, res) => {
    const { status, category, search } = req.query;
    let query = "SELECT i.*, u.name as reporter_name FROM issues i JOIN users u ON i.reporter_id = u.id";
    const params = [];
    let paramIndex = 1;
    
    if (status || category || search) {
        query += " WHERE ";
        const conditions = [];
        if (status) {
            conditions.push(`i.status = $${paramIndex++}`);
            params.push(status);
        }
        if (category) {
            conditions.push(`i.category = $${paramIndex++}`);
            params.push(category);
        }
        if (search) {
            conditions.push(`(i.title ILIKE $${paramIndex} OR i.description ILIKE $${paramIndex})`);
            params.push(`%${search}%`);
        }
        query += conditions.join(" AND ");
    }
    
    query += " ORDER BY votes_count DESC, created_at DESC";

    try {
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Server error while fetching issues." });
    }
};

exports.voteIssue = async (req, res) => {
    const issue_id = req.params.id;
    const user_id = req.session.user.id;
    try {
        await pool.query("BEGIN");
        await pool.query("INSERT INTO votes (user_id, issue_id) VALUES ($1, $2)", [user_id, issue_id]);
        const updatedIssue = await pool.query(
            "UPDATE issues SET votes_count = votes_count + 1 WHERE id = $1 RETURNING votes_count",
            [issue_id]
        );
        await pool.query("COMMIT");
        res.json({ votes_count: updatedIssue.rows[0].votes_count });
    } catch (err) {
        await pool.query("ROLLBACK");
        if (err.code === '23505') { // unique_violation
            return res.status(409).json({ error: "You have already voted for this issue." });
        }
        res.status(500).json({ error: "Server error while voting." });
    }
};

// Add this new function to issueController.js
exports.getAnalytics = async (req, res) => {
    try {
        // 1. Issues per department
        const issuesPerDeptQuery = `
            SELECT category, COUNT(*) as count 
            FROM issues 
            GROUP BY category 
            ORDER BY count DESC;
        `;
        const issuesPerDept = await pool.query(issuesPerDeptQuery);

        // 2. Average resolution time
        const avgResolutionTimeQuery = `
            SELECT AVG(updated_at - created_at) as avg_time 
            FROM issues 
            WHERE status = 'Resolved';
        `;
        const avgResolutionTime = await pool.query(avgResolutionTimeQuery);

        // 3. Status breakdown
        const statusBreakdownQuery = `
            SELECT status, COUNT(*) as count 
            FROM issues 
            GROUP BY status;
        `;
        const statusBreakdown = await pool.query(statusBreakdownQuery);

        res.json({
            issuesPerDepartment: issuesPerDept.rows,
            averageResolutionTime: avgResolutionTime.rows[0]?.avg_time || 'N/A',
            statusBreakdown: statusBreakdown.rows
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server error while fetching analytics." });
    }
};

exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        const updatedIssue = await pool.query(
            "UPDATE issues SET status = $1 WHERE id = $2 RETURNING *",
            [status, id]
        );
        if (updatedIssue.rows.length === 0) {
            return res.status(404).json({ error: "Issue not found." });
        }
        res.json(updatedIssue.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Server error while updating status." });
    }
};