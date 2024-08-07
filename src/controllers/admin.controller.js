import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {Admin} from "../models/admin.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";
//import { application } from "express";

const generateAccessAndRefreshTokens = async(adminId) => {
    try{
        const admin = await Admin.findById(adminId)
        const accessToken = await admin.generateAccessToken()
        const refreshToken = await admin.generateRefreshToken()

        admin.refreshToken = refreshToken
        await admin.save({validateBeforeSave:false})
        return {accessToken,refreshToken}
    }
    catch(error) {
        throw new ApiError(500,"Something went wrong while generating refresh and access token")
    }
}
// const getCurrentTime = () => {
//     const now = new Date();
//     const hours = String(now.getHours()).padStart(2, '0'); // Ensure two digits
//     const minutes = String(now.getMinutes()).padStart(2, '0'); // Ensure two digits
//     return `${hours}:${minutes}`; // Format as HH:MM
// };
const registerAdmin = asyncHandler(async (req,res) =>{
    // get admin details from frontend
    // validation - not empty
    // check if admin already exists: adminname, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create admin object - create entry in db
    // remove password and refresh token field from response
    // check for admin creation
    // return res

    // res.status(200).json({
    //     message:"ok"
    // })
    const {fullName,email,adminname,password} = req.body
    //console.log("email:",email);
    // if(fullName === ""){
    //     throw new ApiError(400,"Fullname is required")
    // }
    if(
        [fullName,email,adminname,password].some((field) =>
        field?.trim() === "")
    ){
        throw new ApiError(400,"All fields are required")
    }
    const existedAdmin = await Admin.findOne({
        $or : [{adminname},{email}]
    })
    if(existedAdmin){
        throw new ApiError(409,"Admin with email or adminname already exists.")
    }
    //console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath  = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath =  req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }
    const admin = await Admin.create({
        fullName,
        avatar: avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        adminname:adminname.toLowerCase()
    })
    const createdAdmin =  await Admin.findById(admin._id).select(
        "-password -refreshToken"
    )
    if(!createdAdmin){
        throw new ApiError(500,"Something went wrong while registering the admin")
    }
    return res.status(201).json(
        new ApiResponse(200,createdAdmin,"Admin registered successfully")
    )
})

const loginAdmin = asyncHandler(async (req,res) => {
    const {adminname,email,password} =req.body
    if(!adminname && !email){
        throw new ApiError(400,"Adminname or email is required");
    }
    const admin = await Admin.findOne({
        $or :[{adminname},{email}]
    })
    if(!admin){
        throw new ApiError(404,"Admin does not exist")
    }
    //finding time of login
    // admin.lastLoginTime = getCurrentTime();
    // admin.online = true;
    // await admin.save();

    const isPasswordValid = await admin.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid admin credentials")
    }
    const {refreshToken,accessToken} = await generateAccessAndRefreshTokens(admin._id)
    const loggedInAdmin = await Admin.findById(admin._id).select(
        "-password -refreshToken"
    )
    const options = {
        httpOnly:true,
        secure:true
    }
    return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(
                200,
            {
               admin: loggedInAdmin, refreshToken,accessToken, 
            }, 
            "Admin loggedIn successfully"
            )
            
        )
    
})
const logoutAdmin = asyncHandler(async (req,res) => {
    await Admin.findByIdAndUpdate(
        req.admin._id,
        {
            $set :{
                refreshToken : undefined
            }   
        },
        {
            new:true
        }
    )
    const options = {
        httpOnly:true,
        secure:true
    }
    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(
            200,
            {},
            "Admin logged Out"
        )
    )
})

const refreshAccessToken = asyncHandler(async (req,res) => {
    const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized Token")
    }
    try {
        const decodeToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
        const admin =await Admin.findById(decodeToken?._id)
        if(!admin){
            throw new ApiError(401,"Invalid refresh token")
        }
        if(incomingRefreshToken !== admin?.refreshToken){
            throw new ApiError(401,"Refresh token is expired and used")
        }
        const options= {
            httpOnly:true,
            secure:true
        }
        const {newrefreshToken,accessToken} = await generateAccessAndRefreshTokens(admin._id)
        return res 
            .status(200)
            .cookie("accesstoken",accessToken,options)
            .cookie("refreshtoken",newrefreshToken,options)
            .json(
                new ApiResponse(
                    200,
                    {accessToken,refreshToken:newrefreshToken},
                    "Access token refreshed"
                )            
            )
        
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
    }
})
const changeCurrentPassword = asyncHandler(async (req,res) => {
    const {oldpassword , newpassword,confpassword} =req.body
    if(!(confpassword === newpassword)){
        throw new ApiError(400,"Password incorrect")
    }
    const admin =await Admin.findById(req.admin?._id)
    const isPasswordCorrect = await admin.isPasswordCorrect(oldpassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password")
    }
    admin.password = newpassword
    await admin.save({validateBeforeSave:false})
    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password change successfully"))
})
const getCurrentAdmin = asyncHandler(async (req,res) => {
    return res 
    .status(200)
    .json(new ApiResponse(200,req.admin,"Current admin fetched successfully"))
})

const updateAccountDetails = asyncHandler(async (req,res) => {
    const {fullName,email} =req.body;
    if(!fullName || !email){
        throw new ApiError(400,"All fields are required")
    }
    const admin = await Admin.findByIdAndUpdate(
        req.admin?._id,
        {
            $set:{
                fullName,
                email:email
            }
        },{new:true}
    ).select("-password")
    return res
    .status(200)
    .json(
        new ApiResponse(200,admin,"Account details updated successfully")
    )

})
const updateAdminAvatar = asyncHandler(async (req,res) => {
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }
    const admin = await Admin.findByIdAndUpdate(
        req.admin?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")
    return res
        .status(200)
        .json(new ApiResponse(200,admin,"Avatar image update successfully"))
    
})

const updateAdminCoverImage = asyncHandler(async (req,res) => {
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover Image file is missing")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading on coverimage")
    }
    const admin = await Admin.findByIdAndUpdate(
        req.admin?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new:true}
    ).select("-password")
    return res
        .status(200)
        .json(new ApiResponse(200,admin,"Cover image update successfully"))
})


// const checkOnline = asyncHandler( async (req, res) => {
//     try {
//       const { adminname } = req.admin;
//       const admin = await Admin.findOne({ adminname });
//       if (admin) {
//         res.json({ online: admin.online });
//       } else {
//         res.status(404).send('Admin not found');
//       }
//     } catch (error) {
//       res.status(500).send('Error checking online status');
//     }
// });

// // Calculate Total Time Excluding Away Periods
// const totalTime = asyncHandler( async (req, res) => {
//     try {
//       const { adminname } = req.admin;
//       const admin = await Admin.findOne({ adminname });
//       if (!admin || !admin.lastLoginTime || !admin.lastLogoutTime) {
//         return res.status(404).send('Admin not found or session data incomplete');
//       }
  
//       const loginTime = new Date(admin.lastLoginTime);
//       const logoutTime = new Date(admin.lastLogoutTime);
//       const totalSessionTime = logoutTime - loginTime; // Total session time in milliseconds
  
//       // Calculate total away time
//       let totalAwayTime = 0;
//       for (const period of admin.awayPeriods) {
//         totalAwayTime += new Date(period.end) - new Date(period.start);
//       }
  
//       // Calculate total active time
//       const totalActiveTime = totalSessionTime - totalAwayTime;
//       const minutes = Math.floor(totalActiveTime / 60000);
//       const seconds = Math.floor((totalActiveTime % 60000) / 1000);
  
//       res.json({ totalActiveTime: `${minutes} minutes and ${seconds} seconds` });
//     } catch (error) {
//       res.status(500).send('Error calculating total active time');
//     }
// });
export {
    registerAdmin,
    loginAdmin,
    logoutAdmin,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentAdmin,
    updateAccountDetails,
    updateAdminAvatar,
    updateAdminCoverImage
    //checkOnline
}