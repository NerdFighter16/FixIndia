exports.isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: "Unauthorized: You must be logged in." });
    }
};

exports.isOfficial = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'official') {
        next();
    } else {
        res.status(403).json({ error: "Forbidden: Only officials can perform this action." });
    }
};