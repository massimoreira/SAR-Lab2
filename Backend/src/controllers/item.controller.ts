import { Request, Response } from 'express';
import Item from "../models/item";
//import User from '../models/user';
import { findItemsOwnedByLoggedUsers } from '../services/item.service';

/**
 * Create a new item
 */
export const createItem = async (req: Request, res: Response): Promise<void> => {
  console.log("NewItem -> received form submission new item");
  console.log(req.body);
  
  try {
    const item = await Item.create({
      description: req.body.description,
      currentbid: req.body.currentbid,
      buynow: req.body.buynow,
      remainingtime: req.body.remainingtime,
      owner: req.body.owner,
      wininguser: '',
      sold: false,
    });
    res.status(201).json(item);
  }
  catch (error) {
    console.error("Error creating item: ", error);
    res.status(500).json({message: "Error creating item"});
  }
};

/**
 * Remove an existing item
 */
export const removeItem = async (req: Request, res: Response): Promise<void> => {
  console.log("RemoveItem -> received form submission remove item");
  console.log(req.body);

  try {
    // usar _id para identificar?
    const item = await Item.deleteOne({owner: req.body.owner, description: req.body.description});
    res.status(200).json({item});
  }
  catch (error) {
    console.error("Error deleting item: ", error);
    res.status(500).json({message:"Error deleting item"});
  }
};

/**
 * Get all items
 */
export const getItems = async (req: Request, res: Response): Promise<void> => {
  // Get all items
  try{
    const items = await findItemsOwnedByLoggedUsers();
    
    // Send response
    res.json(items);
    console.log("received get Items call responded with: ", items);
  }

  catch (error) {
    console.error("Error fetching items: ", error);
    res.status(500).json({message:"Error fetching items"});
  }
};