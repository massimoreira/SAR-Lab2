import { Request, Response } from 'express';
import Item from "../models/item";
//import User from '../models/user';
import { findItemsOwnedByLoggedUsers, processBidWinner } from '../services/item.service';

/**
 * Create a new item
 */
export const createItem = async (req: Request, res: Response): Promise<void> => {
  console.log("NewItem -> received form submission new item");
  console.log(req.body);
  
  // POR FAZER: pode estar a mentir!
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
    const sentItem = req.body.item;
    const item = await Item.findOne({_id: sentItem._id});
    //if (item.owner === )
    await Item.deleteOne({owner: req.body.owner, description: req.body.description});
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

/**
 * Place a bid
 */
export const submitBid = async (req: Request, res:Response): Promise<void> => {
  try {
    // POR FAZER: nao enviar o item e apenas enviar o ID
    const itemSent = req.body.item;
    let message: string;

    if (!itemSent) {
      message = "Error submitting bid: Insufficient information";
      console.error(message);
      res.status(400).json({message: message});
      return;
    }

    const item = await Item.findOne({_id: itemSent._id});

    if (!item) {
      message = "Error submitting bid: Item does not exist.";
      console.error(message);
      res.status(404).json({message: message});
    }
    else if (req.body.username === item.owner) {
      message = "Error submitting bid: User is the owner of the item.";
      console.error(message);
      res.status(400).json({message: message});
    }
    else if (req.body.bid <= item.currentbid) {
      message = "Error submitting bid: Bid is lower than or equal to current bid.";
      console.error(message);
      res.status(406).json({message: message});
    }
    else if (req.body.bid > item.buynow) {
      message = "Error submitting bid: Bid is higher than buy now value.";
      console.error(message);
      res.status(406).json({message: message});
    }
    else if (item.sold) {
      message = "Error submitting bid: Auction has already ended.";
      console.error(message);
      res.status(410).json({message: message});
    }
    else if (req.body.bid === item.buynow) {
      item.currentbid = req.body.bid;
      item.wininguser = req.body.username;
      await processBidWinner(item);
      res.status(200).json({message: "Item bougth sucessfully!"});
    }
    else {
      // Soft bid feature
      if (item.remainingtime < 60)
        await Item.updateOne({_id: itemSent._id}, {currentbid: req.body.bid, wininguser: req.body.username, remainingtime: 60});
      else
        await Item.updateOne({_id: itemSent._id}, {currentbid: req.body.bid, wininguser: req.body.username});
      console.log("User", req.body.username, "placed a bid on item", item.description);
      res.status(200).json({message: "Bid placed sucessfully."});
    }
  }
  catch (error) {
    console.error("Error placing bid: ", error);
    res.status(500).json({message:"Error placing bid"});
  }
}