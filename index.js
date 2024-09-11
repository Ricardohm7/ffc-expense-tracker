const express = require('express')
require('dotenv').config()
const app = express()
const cors = require('cors')
const mongoose = require('mongoose');

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
})

const userModel = mongoose.model("user", userSchema)

const exerciseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: new Date() }
})

const exerciseModel = mongoose.model("exercise", exerciseSchema)

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


app.post('/api/users', async (req, res) => {
  const username = req.body.username;
  const newUser = userModel({ username })
  newUser.save()
  res.json(newUser)
})

app.get('/api/users', async (req, res) => {
  const users = await userModel.find({});
  res.status(200).json(users)
})

app.post('/api/users/:_id/exercises', async (req, res) => {
  const { description, duration, date } = req.body;

  try {
    const userId = req.params._id;
    const exerciseObj = {
      userId: userId,
      description: description,
      duration: parseInt(duration),
      date: date ? new Date(date) : new Date()
    }
    console.log('exercise obj', exerciseObj)

    const newExercise = new exerciseModel(exerciseObj)
    await newExercise.save()

    const userFound = await userModel.findByIdAndUpdate(userId, { $push: { log: newExercise } }, { new: true })
    if (userFound) {
      const response = {
        _id: userId,
        username: userFound.username,
        date: new Date(newExercise.date).toDateString(),
        duration: newExercise.duration,
        description: newExercise.description,
      }
      console.log('Exercise added:', response);
      return res.json(response)
    }
    res.status(404).json({ error: 'User not found' });
  } catch (error) {
    console.error('Error in POST /api/users/:_id/exercises:', error);
    res.status(500).json({ error: error.message });
  }
})

app.get('/api/users/:_id/logs', (req, res) => {
  const userId = req.params._id;

  let limitParam = req.query.limit;
  let toParam = req.query.to;
  let fromParam = req.query.from;

  limitParam = limitParam ? parseInt(limitParam) : undefined;

  let queryObj = { userId };
  if (fromParam || toParam) {
    queryObj.date = {};

    if (fromParam) {
      queryObj.date['$gte'] = new Date(fromParam);
    }

    if (toParam) {
      queryObj.date['$lte'] = new Date(toParam);
    }
  }

  userModel.findById(userId)
    .then((userFound) => {
      if (userFound) {
        let responseObj = {
          _id: userFound._id,
          username: userFound.username
        };

        exerciseModel.find(queryObj).limit(limitParam)
          .sort({ date: 1 })
          .then(exercises => {
            exercises = exercises.map((item) => {
              return {
                description: item.description,
                duration: item.duration,
                date: new Date(item.date).toDateString()
              };
            });
            responseObj.log = exercises;
            responseObj.count = exercises.length;
            return res.json(responseObj);
          })
          .catch(err => {
            console.error('Error finding exercises:', err);
            return res.status(500).json({ error: 'Internal server error' });
          });
      } else {
        console.log('User not found');
        return res.status(404).json({ error: 'User not found' });
      }
    })
    .catch((err) => {
      console.error('Error finding user by ID:', err);
      return res.status(500).json({ error: 'Internal server error' });
    });
});

// console.log('connection string', process.env.MONGO_URI)
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB');
    const listener = app.listen(process.env.PORT || 3000, () => {
      console.log('Your app is listening on port ' + listener.address().port)
    })
  })
  .catch((err) => {
    console.error('Connection error', err);
  });
