import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

// Import services from the barrel file
import { AuctionService, SigninService, SocketService } from '../../../../core/services';

// Import models from the barrel file 
import { Chat, Item, Marker, User } from '../../../../core/models';

@Component({
  selector: 'app-auction',
  templateUrl: './auction.component.html',
  styleUrls: ['./auction.component.css'],
  standalone: false
})
export class AuctionComponent implements OnInit {
  items: Item[]; //array of items to store the items.
  users: User[];
  displayedColumns: string[] //Array of Strings with the table column names
  message: string; // message string
  destination : string; //string with the destination of the current message to send. 
  ChatMessage: string; // message string: string; // message string
  showBid: boolean;  //boolean to control if the show bid form is placed in the DOM
  showMessage: boolean; //boolean to control if the send message form is placed in the DOM
  selectedItem!: Item; //Selected Item
  bidForm! : FormGroup; //FormGroup for the biding
  userName!: string;
  errorMessage: string; //string to store error messages received in the interaction with the api
  mapOptions: google.maps.MapOptions;
  markers: Marker[]; //array to store the markers for the looged users posistions.
  centerLat: number;
  centerLong: number;
  showRemove: boolean;
  soldHistory: string[];
  chats: Chat[]; //array for storing chat messages
  counter: number;

  constructor( private formBuilder: FormBuilder, private router: Router, private socketservice: SocketService, private auctionservice: AuctionService,
   private signinservice: SigninService) {
    this.items = [];
    this.users = [];
    this.soldHistory = [];
    this.chats = [];
    this.counter = 0;
    this.message = "";
    this.destination ="";
    this.ChatMessage = "";
    this.showBid = false;
    this.showMessage = false;
    this.userName = this.signinservice.token.username;
    this.errorMessage = "";
    this.displayedColumns = ['description', 'currentbid', 'buynow', 'remainingtime', 'wininguser', 'owner'];
    this.centerLat = this.signinservice.latitude != null ? this.signinservice.latitude : 38.640026;
    this.centerLong = this.signinservice.longitude != null ? this.signinservice.longitude : -9.155379;
    this.markers = [];
    this.showRemove = false;
    this.mapOptions = {
      center: { lat: this.centerLat, lng: this.centerLong },
      zoom: 10
    };
  }

ngOnInit(): void {
  this.message= "Hello " + this.userName + "! Welcome to the SAR auction site.";

  //create bid form
  this.bidForm = this.formBuilder.group({
  bid: ['', Validators.compose([Validators.required,Validators.pattern("^[0-9]*$")])]
  });


  // Get initial item data from the server api using http call in the auctionservice
  this.auctionservice.getItems()
    .subscribe({next: result => {
      let receiveddata = result as Item[]; // cast the received data as an array of items (must be sent like that from server)
        this.items = receiveddata;
        console.log ("getItems Auction Component -> received the following items: ", receiveddata);
    },
    error: error => this.errorMessage = <any>error });

  // Get initial list of logged in users for googleMaps using http call in the auctionservice
  this.auctionservice.getUsers()
    .subscribe({
      next: result => {
      let receiveddata = result as User[]; // cast the received data as an array of users (must be sent like that from server)
        console.log("getUsers Auction Component -> received the following users: ", receiveddata);
      // do the rest of the needed processing here
    },
    error: error => this.errorMessage = <any>error });

  //subscribe to the incoming websocket events

  //example how to subscribe to the server side regularly (each second) items:update event
  const updateItemsSubscription = this.socketservice.getEvent("update:items")
    .subscribe(
      data =>{
        let receiveddata = data as Item[];
          if (this.items){
            this.items = receiveddata;
          }
      }
    );

  //subscribe to the new user logged in event that must be sent from the server when a client logs in 
  //subscribe to the user logged out event that must be sent from the server when a client logs out 
  //subscribe to a receive:message event to receive message events sent by the server 
  //subscribe to the item sold event sent by the server for each item that ends.
    
  //subscription to any other events must be performed here inside the ngOnInit function

  }

   logout(){
    //call the logout function in the signInService to clear the token in the browser
    this.signinservice.logout();  // Tem que estar em primeiro para ser apagado o token e nao permitir mais reconnects pelo socket
  	//perform any needed logout logic here
  	this.socketservice.disconnect();
    //navigate back to the log in page
    this.router.navigate(['/signin']);
  }

  //function called when an item is selected in the view
  onRowClicked(item: Item){
  	console.log("Selected item = ", item);
  	this.selectedItem = item;
  	this.showBid = true; // makes the bid form appear
    
    if (!item.owner.localeCompare(this.userName)) {
      this.showRemove = true;
      this.showMessage = false;
    }
    else {
      this.showRemove = false;
      this.destination = this.selectedItem.owner;
      this.showMessage = true;
    }
  }

  //function called when a received message is selected. 
  onMessageSender(ClickedChat: Chat) {
    //destination is now the sender of the selected received message. 
  }

  // function called when the submit bid button is pressed
   submit(){
    if (this.bidForm.value.bid > this.selectedItem.currentbid) {
      console.log("submitted bid = ", this.bidForm.value.bid);
      //send an event using the websocket for this use the socketservice
      this.socketservice.sendEvent('send:bid',{description: this.selectedItem.description, bid: this.bidForm.value.bid,
                                    owner: this.selectedItem.owner, username: this.userName});
    }
    else {
      console.error("Bid is lower than current bid");
    }
  }
  //function called when the user presses the send message button
  sendMessage(){
    console.log("Message  = ", this.ChatMessage);
  }

  //function called when the cancel bid button is pressed.
   cancelBid(){
   	this.bidForm.reset(); //clears bid value
   }

   //function called when the buy now button is pressed.

   buyNow(){
   	this.bidForm.setValue({              /// sets the field value to the buy now value of the selected item
   		bid: this.selectedItem.buynow
   	});
   	this.message= this.userName + " please press the Submit Bid button to procced with the Buy now order.";
   }
//function called when the remove item button is pressed.
  removeItem() {
  //use an HTTP call to the API to remove an item using the auction service.
    //console.log("Tried to remove item: ", this.selectedItem);
    this.auctionservice.removeItem(this.selectedItem).subscribe({
      next: result => {
        console.log('Item removed', result);
        // optionally update local state here
        this.items = this.items.filter(item => item !== this.selectedItem);
        this.showRemove = false;
      },
      error: err => {
        this.errorMessage = err.message || String(err);
        console.error('Remove item failed', err);
      }
    });
  }

  /**
   * Calculate the time progress percentage for the auction item
   * @param item The auction item
   * @returns A number between 0-100 representing progress percentage
   */
  getTimeProgress(item: Item): number {
    if (!item || !item.remainingtime) {
      return 0;
    }

    const maxTime = 3600000; // Assuming initial time is 1 hour (3600000 ms)
    const remainingTime = item.remainingtime;
    
    // Calculate elapsed time as a percentage
    const elapsedPercentage = ((maxTime - remainingTime) / maxTime) * 100;
    
    // Return a percentage value between 0-100
    return Math.min(Math.max(elapsedPercentage, 0), 100);
  }

  /**
   * Determine the color of the progress bar based on remaining time
   * @param item The auction item
   * @returns Material color for the progress bar
   */
  getTimeProgressColor(item: Item): string {
    if (!item || !item.remainingtime) {
      return 'warn'; // Red when no time or item data
    }

    // More than 50% time remaining - show green
    if (item.remainingtime > 1800000) {
      return 'primary'; // Blue
    } 
    // Between 25% and 50% time remaining - show accent (amber)
    else if (item.remainingtime > 900000) {
      return 'accent';
    } 
    // Less than 25% time remaining - show red
    else {
      return 'warn'; // Red
    }
  }

}
