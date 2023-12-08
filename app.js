const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const mysql = require('mysql2');

const app = express();
const port = 3000;

// MySQL Database setup
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'quizzify'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL database:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Middleware
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'your-secret-key', resave: true, saveUninitialized: true }));

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/register', (req, res) => {
  res.sendFile(__dirname + '/public/register.html');
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/public/login.html');
});

app.get('/hub', (req, res) => {
  res.sendFile(__dirname + '/public/hub.html');
});

app.get('/create-quiz', (req, res) => {
  res.sendFile(__dirname + '/public/create-quiz.html');
});

app.get('/take-quiz', (req, res) => {
  res.sendFile(__dirname + '/public/take-quiz.html');
});

// Implement routes for handling quiz creation and submission on the server
// Example routes; replace these with your actual server-side logic
app.post('/create-quiz', (req, res) => {
  const { quizTitle, quizDescription, questions } = req.body;

  // Insert quiz data into the database
  const insertQuizQuery = 'INSERT INTO quizzes (title, description, instructor_id) VALUES (?, ?, ?)';
  db.query(insertQuizQuery, [quizTitle, quizDescription, /* instructor_id - You need to set this based on your logic */], (err, result) => {
    if (err) {
      console.error('Error creating quiz:', err);
      return res.status(500).send('Error creating quiz');
    }

    const quizId = result.insertId; // Get the ID of the newly inserted quiz

    // Insert questions and answers into the database
    questions.forEach((question) => {
      const { questionText, answers } = question;

      // Insert question data into the database
      const insertQuestionQuery = 'INSERT INTO questions (quiz_id, question_text, question_type) VALUES (?, ?, ?)';
      db.query(insertQuestionQuery, [quizId, questionText, /* question_type - You need to set this based on your logic */], (err, result) => {
        if (err) {
          console.error('Error creating question:', err);
          return res.status(500).send('Error creating question');
        }

        const questionId = result.insertId; // Get the ID of the newly inserted question

        // Insert answer data into the database
        answers.forEach((answer) => {
          const { answerText } = answer;
          const insertAnswerQuery = 'INSERT INTO answers (question_id, answer_text, is_correct) VALUES (?, ?, ?)';
          // Set the 'is_correct' field based on your logic
          db.query(insertAnswerQuery, [questionId, answerText, /* is_correct - You need to set this based on your logic */], (err) => {
            if (err) {
              console.error('Error creating answer:', err);
              return res.status(500).send('Error creating answer');
            }
          });
        });
      });
    });

    res.send('Quiz created successfully!');
  });
});

app.post('/submit-quiz', (req, res) => {
  // Implement quiz submission logic on the server
  // You can access the user's responses from req.body
  // This is a basic example and needs further implementation based on your server structure
  res.send('Quiz submitted successfully!');
});

app.post('/register', async (req, res) => {
  const { username, password, role } = req.body;

  // Hash password before saving it
  const hashedPassword = await bcrypt.hash(password, 10);

  const insertQuery = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
  db.query(insertQuery, [username, hashedPassword, role], (err) => {
    if (err) {
      return res.status(500).send('Error registering user');
    }
    res.redirect('/login');
  });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const selectQuery = 'SELECT * FROM users WHERE username = ?';
  db.query(selectQuery, [username], async (err, results) => {
    if (err) {
      return res.status(500).send('Error authenticating user');
    }

    if (results.length === 0) {
      return res.status(401).send('Invalid username or password');
    }

    const isPasswordValid = await bcrypt.compare(password, results[0].password);

    if (!isPasswordValid) {
      return res.status(401).send('Invalid username or password');
    }

    req.session.user = username;
    res.redirect('/hub'); // Redirect to your dashboard page
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});