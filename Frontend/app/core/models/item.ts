export class Item {

	constructor (
      public description: string,
      public currentbid: number,
      public remainingtime: number,
      public buynow: number,
      public wininguser: string,
      public owner: string,
      public _id?: any
	){}
}
