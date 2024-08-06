import mongoose ,{Schema} from "mongoose";
const StatsSchema = new Schema({
    agents:[{
        type:Schema.Types.ObjectId,
        ref :"User",
        required:true
    }],
    status:{
        type:Boolean,
        required:true,
        default:false
    },
    attempted:{
        
    },
    noOfOffers:[{
        type:Schema.Types.ObjectId,
        ref:"Offer"
    }],
    loginTime:{
        type:String
    },
    awayTime:[{ 
        start: Date,
        end: Date 
    }],
    logOutTime: {
        type:String
    },
    onetothreemin:{

    },
    threetofivemin:{

    },
    fivetosevenmin:{

    },
    seventotenmin:{

    },
    tentotwentymin:{

    },
    twentyplusmin:{

    },
    totalTalkTime:{

    },
    noOfSales:{

    },
    expectedSales:{

    },
    totalAmount:{
        
    }

},{
    timestamps:true
})
export const Stats = mongoose.model("Stats",StatsSchema)