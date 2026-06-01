import Item from '../models/item';
import User from '../models/user';

export const findItemsOwnedByLoggedUsers = async () => {
  const loggedUsers = await User.find({ islogged: true })
    .select('username -_id')
    .lean();
  const usernames = loggedUsers.map(u => u.username);
  return Item.find({ owner: { $in: usernames } , sold: false}).lean();
};