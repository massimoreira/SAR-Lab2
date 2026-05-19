import * as jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import config from '../config/config';
import Item from '../models/item';

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
      socket.on('newUser:username', (data) => {
        console.log("newUser:username -> New user event received: ", data);
      });

      // Handle bid event
      socket.on('send:bid', async (data) => {
        console.log("send:bid -> Received event send:bid with data = ", data);
        const item = await Item.findOne({owner: data.owner, description: data.description});
        const socketID = this.socketIDbyUsername.get(username);
        if (socketID == null){
          console.error("send:bid -> Error on socketID");
        }
        else if (item == null) {
          this.io?.to(socketID).emit('auction:error', {'message': 'Item not found.'});
          console.error("send:bid -> Item not found");
        }
        else if (data.bid <= item.currentbid) {
          this.io?.to(socketID).emit('auction:error', {'message': 'Bid is lower than current bid.', 'currentbid': item.currentbid});
          console.error("send:bid -> Bid ", data.bid, " is lower than current bid.");
        }
        else if (data.bid > item.buynow) {
          this.io?.to(socketID).emit('auction:error', {'message': 'Bid is higher than buy now value.', 'buynow': item.buynow});
          console.error("send:bid -> Bid ", data.bid, " is higher than buy now value.");
        }
        // POR FAZER: nao deve ser so isto
        else if (data.bid === item.buynow) {
          //item.sold = true;
          //item.owner = username;
          await Item.updateOne({owner: data.owner, description: data.description}, {sold: true, owner: username});
          this.io?.emit("update:items", await Item.find());
          console.log("send:bid -> User", username, "bougth the item:", item.description);
        }
        else {
          //item.currentbid = data.bid;
          //item.wininguser = username;
          await Item.updateOne({owner: data.owner, description: data.description}, {currentbid: data.bid, wininguser: username});
          const item2 = await Item.findOne({owner: data.owner, description: data.description});
          console.log("Item updated:", item2);
          this.io?.emit("update:items", await Item.find());
          console.log("send:bid -> User", username, "placed a bid on the item:", item.description);
        }
      });

      // Handle message event
      socket.on('send:message', (chat) => {
        console.log("send:message received with -> ", chat);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log("User disconnected");
        const username = this.usernamebySocketID.get(socket.id);
        if (username) {
          this.socketIDbyUsername.delete(username);
          // POR FAZER: insert islogged = false
        }
        this.usernamebySocketID.delete(socket.id);
      });
    });
  }

  /**
   * Start auction timer for item remaining time updates
   */
  private startAuctionTimer(): void {
    // Timer function to decrement remaining time 
    this.intervalId = setInterval(() => {
      //  update item times here
      // add actual database operations
    }, 1000);
  }

  /**
   * Broadcast new logged-in user to all clients
   */
  public newLoggedUserBroadcast(newUser: any): void {
    if (this.io) {
      for (const socketID of this.socketIDbyUsername.values()) {
        this.io.to(socketID).emit('new:item', newUser);
      }
    }
  }

  /**
   * Broadcast user logged-out event to all clients
   */
  public userLoggedOutBroadcast(loggedOutUser: any): void {
    console.log('RemoveItemBroadcast -> ', loggedOutUser);
    if (this.io) {
      for (const socketID of this.socketIDbyUsername.values()) {
        this.io.to(socketID).emit('remove:item', loggedOutUser);
      }
    }
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

export default new SocketService();