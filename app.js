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
app.use(express.json());
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

// New route for fetching quiz details by ID
app.get('/api/quiz/:quizId', (req, res) => {
  const quizId = req.params.quizId;

  // Retrieve quiz details from the database
  const selectQuizQuery = 'SELECT * FROM quizzes WHERE quiz_id = ?';
  db.query(selectQuizQuery, [quizId], (err, results) => {
    if (err) {
      console.error('Error fetching quiz details:', err);
      return res.status(500).send('Error fetching quiz details');
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    const quizDetails = {
      id: results[0].quiz_id,
      title: results[0].title,
      description: results[0].description,
      instructorId: results[0].instructor_id
      // Add more fields as needed
    };

    // Retrieve questions associated with the quiz
    const selectQuestionsQuery = 'SELECT * FROM questions WHERE quiz_id = ?';
    db.query(selectQuestionsQuery, [quizId], (err, questionResults) => {
      if (err) {
        console.error('Error fetching questions:', err);
        return res.status(500).send('Error fetching questions');
      }

      const questions = questionResults.map(question => ({
        question_id: question.question_id,
        question_text: question.question_text
        // Add more fields as needed
      }));

      quizDetails.questions = questions;

      // Retrieve options (answers) associated with each question
      const selectOptionsQuery = 'SELECT * FROM options WHERE question_id = ?';
      const optionsPromises = questions.map(question => new Promise((resolve, reject) => {
        db.query(selectOptionsQuery, [question.question_id], (err, optionResults) => {
          if (err) {
            console.error('Error fetching options:', err);
            reject(err);
          } else {
            const options = optionResults.map(option => ({
              option_id: option.option_id,
              option_text: option.option_text,
              is_correct: option.is_correct
              // Add more fields as needed
            }));
            question.options = options;
            resolve();
          }
        });
      }));

      Promise.all(optionsPromises)
        .then(() => {
          res.json(quizDetails);
        })
        .catch(() => {
          res.status(500).send('Error fetching options');
        });
    });
  });
});

app.post('/api/submit-quiz/:quizId', async (req, res) => {
  const quizId = req.params.quizId;
  const userResponses = req.body.userResponses;

  // Check if userResponses is an array
  if (!Array.isArray(userResponses)) {
    return res.status(400).json({ error: 'Invalid format for userResponses' });
  }

  try {
    // For each question in userResponses, check correctness
    const scorePromises = userResponses.map(async (response) => {
      const { question_id, userSelectedOptions } = response;

      // Retrieve correct options from the database
      const selectCorrectOptionsQuery = 'SELECT option_text FROM options WHERE question_id = ? AND is_correct = true';
      const correctOptionsResults = await new Promise((resolve, reject) => {
        db.query(selectCorrectOptionsQuery, [question_id], (err, results) => {
          if (err) {
            console.error('Error fetching correct options:', err);
            reject(err);
          } else {
            resolve(results);
          }
        });
      });

      const correctOptions = correctOptionsResults.map(option => option.option_text);

      // Check if user's selected options match the correct options
      return arraysEqual(userSelectedOptions, correctOptions) ? 1 : 0;
    });

    // Wait for all score promises to resolve
    const scores = await Promise.all(scorePromises);

    // Calculate the total score
    const totalScore = scores.reduce((acc, score) => acc + score, 0);

    // Send the total score to the client
    res.json({ score: totalScore });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).send('Error evaluating quiz');
  }
});

// Helper function to check if two arrays are equal
function arraysEqual(arr1, arr2) {
  return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
}

// Implement routes for handling quiz creation and submission on the server
app.post('/create-quiz', (req, res) => {
  const { quizTitle, quizDescription, questions } = req.body;

  console.log('Received data:', { quizTitle, quizDescription, questions });
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
      const { questionText, answers, correctAnswer } = question;

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
        answers.forEach((answer, index) => {
          const { answerText } = answer;
          const isCorrectValue = correctAnswer && correctAnswer.includes(index.toString()) ? 1 : 0;
    
          const insertAnswerQuery = 'INSERT INTO options (question_id, option_text, is_correct) VALUES (?, ?, ?)';
          db.query(insertAnswerQuery, [questionId, answerText, isCorrectValue], (err) => {
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
  res.send('Quiz submitted successfully!');
});

app.get('/quiz/:quizId', (req, res) => {
  const quizId = req.params.quizId;
  res.sendFile(__dirname + '/public/take-quiz.html');
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