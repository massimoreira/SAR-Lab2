import Item from '../models/item';
import User from '../models/user';
import { socketService } from "../server";


/**
 * Finds the items owned by the logged users
 */
export const findItemsOwnedByLoggedUsers = async () => {
  const loggedUsers = await User.find({ islogged: true })
    .select('username -_id')
    .lean();
  const usernames = loggedUsers.map(u => u.username);
  return Item.find({ owner: { $in: usernames } , sold: false}).lean();
};

/**
 * Processes the bid winner
 */
export const processBidWinner = async (item: any): Promise<void> => {
    // no one made a bid
    if (!item.wininguser) {
      console.log("No one bid on the item", item.description, "and it returned to the owner");
      await Item.updateOne({_id: item._id}, {remainingtime: undefined, buynow: undefined, sold: true});
    }
    else {
      console.log("Item", item.description, "sold to user", item.wininguser);
      await Item.updateOne({_id:item._id}, {owner: item.wininguser, remainingtime: undefined, buynow: undefined, sold: true, wininguser: undefined});
      socketService.itemSoldBroadcast(item);
    }
  }