const bcrypt = require('bcrypt');
const pool = require('../config/db');

exports.register = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await pool.query(
            "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role",
            [name, email, hashedPassword]
        );
        res.status(201).json({ message: "User registered successfully", user: newUser.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Email already exists or server error." });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (userResult.rows.length === 0) {
            return res.status(400).json({ error: "Invalid credentials" });
        }
        const user = userResult.rows[0];
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(400).json({ error: "Invalid credentials" });
        }
        req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
        res.json({ message: "Logged in successfully", user: req.session.user });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send("Could not log out.");
        }
        res.redirect('/');
    });
};