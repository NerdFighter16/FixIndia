require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');

const authRoutes = require('./routes/authRoutes');
const issueRoutes = require('./routes/issueRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);

app.get('/', (req, res) => res.render('index'));
app.get('/login', (req, res) => res.render('login'));
app.get('/register', (req, res) => res.render('register'));

app.get('/report', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('report');
});

app.get('/department/:name', (req, res) => {
    const departmentName = req.params.name;
    const validDepartments = [
        "Roads & Infrastructure",
        "Electricity Supply",
        "Water & Drainage",
        "Sanitation & Waste",
        "Other Civic Issues"
    ];
    if (validDepartments.includes(departmentName)) {
        res.render('department', { departmentName: departmentName });
    } else {
        res.status(404).send('Department not found');
    }
});

app.get('/manage-issues', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'official') {
        return res.status(403).send('Access Denied');
    }
    res.render('dashboard');
});

app.get('/analytics', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'official') {
        return res.status(403).send('Access Denied');
    }
    res.render('analytics');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});