import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import config from '../config/config';
import User from '../models/user';

/**
 * Handle user authentication
 * Note: Original dummy functionality
 */
export const authenticate = async (req: Request, res: Response): Promise<void> => {
  console.log('Authenticate -> Received Authentication POST');
  
  try {
  // Generate JWT token, you should use a real user authentication here check in the database
    const user = await User.findOne({ username: req.body.username });

    if (user === null) {
      console.error("User does not exist");
      res.status(406).json({message: "User does not exist"});
    }
    else if (req.body.password !== user.get('password')) {
      console.error("Password does not match");
      res.status(401).json({message: "Password does not match"});
    }
    else {
      const token = jwt.sign({sub: user._id, username: user.username}, config.jwtSecret, {expiresIn: '1h'});
      // Send response with token
      user.islogged = true;
      res.json({
        username: req.body.username,
        token
      });
    }
  }
  catch (error) {
    console.error('Error saving user: ', error);
    res.status(500).json({ message: 'Failed to authenticate' });
  }
  
  
  //console.log('Authenticate -> Received Authentication POST');
};

/**
 * Handle user registration
 * Note: Original dummy functionality
 */
export const registerUser = async (req: Request, res: Response): Promise<void> => {
  console.log("NewUser -> received form submission new user");
  console.log(req.body);

  if (await User.exists({username: req.body.username})) {
    res.status(400).json({message: "There is already a user with such username"});
  }
  else if (await User.exists({email: req.body.email})) {
    res.status(400).json({message: "There is already a user with such email"});
  }
  else {
    try {
      // Create new user
      const user = await User.create({
        name: req.body.name,
        email: req.body.email,
        username: req.body.username,
        password: req.body.password,
        islogged: false,
        latitude: 0,
        longitude: 0
      });

      // Send user information to client
      res.status(201).json(user);
    }
    catch (error) {
      // Database error
      console.error('Error saving user: ', error);
      res.status(500).json({ message: 'Failed to save user' });
    }
  }
};

/**
 * Get all users
 * Note: Maintaining original dummy functionality
 */
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  // Go to the database and get all users
  const users = await User.find();

  res.json(users);
};