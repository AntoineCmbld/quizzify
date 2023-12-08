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

app.get('/api/user', (req, res) => {
  if (req.session.user) {
    const { id, username, role } = req.session.user;
    res.json({ id, username, role });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

app.get('/api/quizzes', (req, res) => {
  const selectQuizzesQuery = 'SELECT * FROM quizzes';
  db.query(selectQuizzesQuery, (err, results) => {
    if (err) {
      console.error('Error fetching quizzes:', err);
      return res.status(500).send('Error fetching quizzes');
    }

    const quizzes = results.map(quiz => ({
      id: quiz.quiz_id,
      title: quiz.title,
      description: quiz.description,
      instructorId: quiz.instructor_id
      // Add more fields as needed
    }));

    res.json(quizzes);
  });
});

// Implement routes for handling quiz creation and submission on the server
app.post('/create-quiz', (req, res) => {
  const { quizTitle, quizDescription, questions } = req.body;

  // Check if 'questions' is an array
  if (!Array.isArray(questions)) {
    return res.status(400).send('Invalid format for questions array');
  }

  // Insert quiz data into the database
  const insertQuizQuery = 'INSERT INTO quizzes (title, description, instructor_id) VALUES (?, ?, ?)';
  // Assuming the instructor ID is stored in the session when the user logs in
  const instructorId = req.session.user.id;
  db.query(insertQuizQuery, [quizTitle, quizDescription, instructorId], (err, result) => {
    if (err) {
      console.error('Error creating quiz:', err);
      return res.status(500).send('Error creating quiz');
    }

    const quizId = result.insertId; // Get the ID of the newly inserted quiz

    // Insert questions and answers into the database
    questions.forEach((question) => {
      const { questionText, answers } = question;

      // Check if 'answers' is an array
      if (!Array.isArray(answers)) {
        return res.status(400).send('Invalid format for answers array');
      }

      // Insert question data into the database
      const insertQuestionQuery = 'INSERT INTO questions (quiz_id, question_text) VALUES (?, ?)';
      db.query(insertQuestionQuery, [quizId, questionText], (err, result) => {
        if (err) {
          console.error('Error creating question:', err);
          return res.status(500).send('Error creating question');
        }

        const questionId = result.insertId; // Get the ID of the newly inserted question

        // Insert answer data into the database
        answers.forEach((answer) => {
          const { answerText, isCorrect } = answer;
          const insertAnswerQuery = 'INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)';
          // Set the 'is_correct' field based on your logic
          db.query(insertAnswerQuery, [questionId, answerText, isCorrect], (err) => {
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

    // Set the session variable
    req.session.user = {
      id: results[0].user_id,
      username: results[0].username,
      role: results[0].role
    };

    res.redirect('/hub'); // Redirect to your dashboard page
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});