import express from 'express';
import path from 'path';
import session from 'express-session';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'url';

// Get current directory (for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const mongoUrl = 'mongodb://127.0.0.1:27017'; // MongoDB URL
const client = new MongoClient(mongoUrl);
let db;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");
    db = client.db('myDB'); // Use or create database named 'myDB'
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1); // Exit if the connection fails
  }
}
connectToMongoDB();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(
  session({
    secret: 'yourSecretKey', 
    resave: false,
    saveUninitialized: false,
  })
);

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next(); // User is logged in, proceed to the next middleware/route
  } else {
    res.redirect('/'); // Redirect to login page if not logged in
  }
}

// Routes

// Login Page
app.get('/', (req, res) => {
  const message = req.query.message; // Capture success or error messages from the query string
  res.render('login', { message });
});

// Registration Page
app.get('/registration', (req, res) => {
  res.render('registration', { errorMessage: null }); // Render the registration page with no error message initially
});

// Handle Registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Validation: Check if fields are empty
  if (!username || !password) {
    return res.status(400).render('registration', {
      errorMessage: "Username and password are required!",
    });
  }

  try {
    // Check if username already exists
    const user = await db.collection('users').findOne({ username });
    if (user) {
      return res.status(400).render('registration', {
        errorMessage: "Username already exists! Please choose a different one.",
      });
    }

    // Insert new user into the database
    await db.collection('users').insertOne({ username, password });

    // Redirect to login page with success message
    res.redirect('/?message=Registration successful! Please log in.');
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Handle Login
app.post('/', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if username exists in the database
    const user = await db.collection('users').findOne({ username });

    if (!user || user.password !== password) {
      return res.status(401).render('login', {
        message: "Invalid username or password!",
      });
    }

    // Save user info in session
    req.session.user = { username };

    // Redirect to home page if login is successful
    res.redirect('/home');
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).send("Internal Server Error");
  }
});



// Restricted Routes
app.get('/home', isAuthenticated, (req, res) => {
  res.render('home', { username: req.session.user.username });
});


// Handle Adding to Want-to-Go List
app.post('/wanttogo', isAuthenticated, async (req, res) => {
  const { destination } = req.body; // Extract destination from the form submission
  const username = req.session.user.username; // Get the logged-in user's username from the session

  try {
    // Retrieve the user's document from the database
    const user = await db.collection('users').findOne({ username });

    // Check if the destination is already in the Want-to-Go List
    if (user.wantToGoList && user.wantToGoList.includes(destination)) {
      // If it exists, render an error message
      return res.status(400).send('This destination is already in your Want-to-Go list!');
    }

    // Add the destination to the user's Want-to-Go List
    await db.collection('users').updateOne(
      { username },
      { $push: { wantToGoList: destination } }
    );

    // Redirect to the Want-to-Go List page after successful addition
   // res.redirect('/wanttogo');
  } catch (error) {
    console.error("Error adding to Want-to-Go List:", error);
    res.status(500).send("Internal Server Error");
  }
});

// View Want-to-Go List
app.get('/wanttogo', isAuthenticated, async (req, res) => {
  const username = req.session.user.username; // Get the logged-in user's username from the session

  try {
    // Retrieve the user's Want-to-Go List from the database
    const user = await db.collection('users').findOne({ username });
    const wantToGoList = user?.wantToGoList || []; // Default to an empty list if none exists

    // Render the Want-to-Go List page with the retrieved destinations
    res.render('wanttogo', { wantToGoList });
  } catch (error) {
    console.error("Error retrieving Want-to-Go List:", error);
    res.status(500).send("Internal Server Error");
  }
});

const destinations = {
  "Inca Trail to Machu Picchu": "/inca",
  "Annapurna Circuit": "/annapurna",
  "Bali Island": "/bali",
  "Santorini Island": "/santorini",
  "Paris": "/paris",
  "Rome": "/rome",
};

app.post('/search', isAuthenticated, (req, res) => {
  const searchKey = req.body.Search.toLowerCase(); // Convert to lowercase for case-insensitive comparison
  const matchingDestinations = Object.entries(destinations).filter(([name]) =>
      name.toLowerCase().includes(searchKey)
  );

  res.render('searchresults', {
      searchKey,
      results: matchingDestinations.map(([name, link]) => ({
          name,
          link,
      })),
  });
});




app.get('/annapurna', isAuthenticated, function(req, res) {
  res.render('annapurna');
});
app.get('/bali', isAuthenticated, function(req, res) {
  res.render('bali');
});
app.get('/hiking', isAuthenticated, function(req, res) {
  res.render('hiking');
});
app.get('/inca', isAuthenticated, function(req, res) {
  res.render('inca');
});
app.get('/islands', isAuthenticated, function(req, res) {
  res.render('islands');
});
app.get('/cities', isAuthenticated, function(req, res) {
  res.render('cities');
});
app.get('/rome', isAuthenticated, function(req, res) {
  res.render('rome');
});
app.get('/paris', isAuthenticated, function(req, res) {
  res.render('paris');
});
app.get('/santorini', isAuthenticated, function(req, res) {
  res.render('santorini');
});


app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
 