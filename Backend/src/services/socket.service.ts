import * as jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import config from '../config/config';
import Item from '../models/item';
import User from '../models/user';
import { findItemsOwnedByLoggedUsers } from '../services/item.service';

class SocketService {
  private io: Server | null = null;
  private socketIDbyUsername: Map<string, string> = new Map();
  private usernamebySocketID: Map<string, string> = new Map();
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Initialize Socket.IO server
   */
  public init(io: Server): void {
    this.io = io;
    
    // JWT authentication for socket.io
    io.use((socket: Socket, next) => {
      // Check for token in query or auth object (supporting both methods)
      const authData = socket.handshake.auth as Record<string, unknown> | undefined;
      const queryToken = socket.handshake.query?.token;
      const token =
        (typeof queryToken === 'string' ? queryToken : undefined) ||
        (typeof authData?.token === 'string' ? authData.token : undefined);
        
      if (token) {
        jwt.verify(token, config.jwtSecret, (err: jwt.VerifyErrors | null, decoded: unknown) => {
          if (err) {
            console.error('Socket auth error:', err.message);
            return next(new Error('Authentication error'));
          }
          socket.data.decoded_token = decoded;
          next();
        });
      } else {
        console.error('Socket auth error: No token provided');
        next(new Error('Authentication error: No token provided'));
      }
    });

    console.log('Socket service initialized');
    this.setupSocketEvents();
    this.startAuctionTimer();
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketEvents(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const username = socket.data.decoded_token.username;
      console.log(`${username} user connected`);
      
      // Store client in the maps
      this.socketIDbyUsername.set(username, socket.id);
      this.usernamebySocketID.set(socket.id, username);

      // Handle new user event
      socket.on('newUser:username', async (data) => {
        console.log("newUser:username -> New user event received: ", data);
        await User.updateOne({username: username}, {islogged: true});
        this.newLoggedUserBroadcast(username);
      });

      // Handle bid event
      socket.on('send:bid', async (data) => {
        console.log("send:bid -> Received event send:bid with data = ", data);
        const itemSent = data.item;
        const item = await Item.findOne({_id: itemSent._id});
        if (socket.id == null){
          console.error("send:bid -> Error on socketID");
        }
        else if (item == null) {
          this.io?.to(socket.id).emit('auction:error', {'message': 'Item not found.'});
          console.error("send:bid -> Item not found");
        }
        else if (data.bid <= item.currentbid) {
          this.io?.to(socket.id).emit('auction:error', {'message': 'Bid is lower than current bid.', 'currentbid': item.currentbid});
          console.error("send:bid -> Bid ", data.bid, " is lower than current bid.");
        }
        else if (data.bid > item.buynow) {
          this.io?.to(socket.id).emit('auction:error', {'message': 'Bid is higher than buy now value.', 'buynow': item.buynow});
          console.error("send:bid -> Bid ", data.bid, " is higher than buy now value.");
        }
        else if (item.sold) {
          this.io?.to(socket.id).emit('auction:error', {'message': 'Auction already closed'});
          console.error("send:bid -> Auction already closed");
        }
        else if (data.bid === item.buynow) {
          item.currentbid = data.bid;
          item.wininguser = username;
          await this.processBidWinner(item);
          //this.io?.emit("update:items", await Item.find());
          console.log("send:bid -> User", username, "bougth the item:", item.description);
        }
        else {
          //item.currentbid = data.bid;
          //item.wininguser = username;
          await Item.updateOne({_id: itemSent._id}, {currentbid: data.bid, wininguser: username});
          const item2 = await Item.findOne({_id: itemSent._id});
          console.log("Item updated:", item2);
          //this.io?.emit("update:items", await Item.find());
          console.log("send:bid -> User", username, "placed a bid on the item:", item.description);
        }
      });

      // Handle message event
      socket.on('send:message', (chat) => {
        console.log("send:message received with -> ", chat);
        const destination = this.socketIDbyUsername.get(chat.receiver);
        if (destination)
          this.io?.to(destination).emit("receive:message", chat);
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        console.log("User disconnected");
        const username = this.usernamebySocketID.get(socket.id);
        if (username) {
          this.socketIDbyUsername.delete(username);
          await User.updateOne({username: username}, {islogged: false});
        }
        this.usernamebySocketID.delete(socket.id);
        this.userLoggedOutBroadcast(username);
      });
    });
  }

  /**
   * Start auction timer for item remaining time updates
   */
  private async startAuctionTimer(): Promise<void> {
    // Timer function to decrement remaining time 
    this.intervalId = setInterval(async () => {
      for (const item of await findItemsOwnedByLoggedUsers()) {
        if (item.remainingtime <= 1) {
          // process bid winner
          this.processBidWinner(item);
        }
        // retract time
        else await Item.updateOne({_id: item._id}, {remainingtime: item.remainingtime - 1});
      }
      this.io?.emit("update:items", await findItemsOwnedByLoggedUsers());
    }, 1000);
  }

  /**
   * Process bid winner
   */
  private async processBidWinner(item: any): Promise<void> {
    // no one made a bid
    if (!item.wininguser) {
      console.log("No one bid on the item", item.description, "and it returned to the owner");
      await Item.updateOne({_id: item._id}, {remainingtime: undefined, buynow: undefined, sold: true});
    }
    else {
      console.log("Item", item.description, "sold to user", item.wininguser);
      await Item.updateOne({_id:item._id}, {owner: item.wininguser, remainingtime: undefined, buynow: undefined, sold: true, wininguser: undefined});
      this.itemSoldBroadcast(item);
    }
  }
  
  /**
   * Broadcast new logged-in user to all clients
   */
  private newLoggedUserBroadcast(newUser: any): void {
    if (this.io) {
      for (const socketID of this.socketIDbyUsername.values()) {
        this.io.to(socketID).emit('new:item', newUser);
      }
    }
  }

  /**
   * Broadcast user logged-out event to all clients
   */
  private userLoggedOutBroadcast(loggedOutUser: any): void {
    console.log('UserLoggerOutBroadcast -> ', loggedOutUser);
    if (this.io) {
      for (const socketID of this.socketIDbyUsername.values()) {
        this.io.to(socketID).emit('remove:item', loggedOutUser);
      }
    }
  }

  /**
   * Broadcast item sold
   */
  private itemSoldBroadcast(item: any): void {
    console.log("Sent bid closure info about item:", item.description);
    if (this.io) {
      const message = "Item " + item.description + " sold to " + item.wininguser + " for " + item.currentbid;
      for (const socketID of this.socketIDbyUsername.values()) {
        this.io.to(socketID).emit('send:info', message);
      }
    }
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

export default new SocketService();