import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";
import { application } from "express";

const generateAccessAndRefreshTokens = async(userId) => {
    try{
        const user = await User.findById(userId)
        const accessToken = await user.generateAccessToken()
        const refreshToken = await user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave:false})
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
const registerUser = asyncHandler(async (req,res) =>{
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    // res.status(200).json({
    //     message:"ok"
    // })
    const {fullName,email,username,password} = req.body
    //console.log("email:",email);
    // if(fullName === ""){
    //     throw new ApiError(400,"Fullname is required")
    // }
    if(
        [fullName,email,username,password].some((field) =>
        field?.trim() === "")
    ){
        throw new ApiError(400,"All fields are required")
    }
    const existedUser = await User.findOne({
        $or : [{username},{email}]
    })
    if(existedUser){
        throw new ApiError(409,"User with email or username already exists.")
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
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })
    const createdUser =  await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully")
    )
})

const loginUser = asyncHandler(async (req,res) => {
    const {username,email,password} =req.body
    if(!username && !email){
        throw new ApiError(400,"Username or email is required");
    }
    const user = await User.findOne({
        $or :[{username},{email}]
    })
    if(!user){
        throw new ApiError(404,"User does not exist")
    }
    //finding time of login
    // user.lastLoginTime = getCurrentTime();
    // user.online = true;
    // await user.save();

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }
    const {refreshToken,accessToken} = await generateAccessAndRefreshTokens(user._id)
    const loggedInUser = await User.findById(user._id).select(
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
               user: loggedInUser, refreshToken,accessToken, 
            }, 
            "User loggedIn successfully"
            )
            
        )
    
})
const logoutUser = asyncHandler(async (req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset :{
                refreshToken:1
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
            "User logged Out"
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
        const user =await User.findById(decodeToken?._id)
        if(!user){
            throw new ApiError(401,"Invalid refresh token")
        }
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Refresh token is expired and used")
        }
        const options= {
            httpOnly:true,
            secure:true
        }
        const {newrefreshToken,accessToken} = await generateAccessAndRefreshTokens(user._id)
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
    const user =await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldpassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password")
    }
    user.password = newpassword
    await user.save({validateBeforeSave:false})
    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password change successfully"))
})
const getCurrentUser = asyncHandler(async (req,res) => {
    return res 
    .status(200)
    .json(new ApiResponse(200,req.user,"Current user fetched successfully"))
})

const updateAccountDetails = asyncHandler(async (req,res) => {
    const {fullName,email} =req.body;
    if(!fullName || !email){
        throw new ApiError(400,"All fields are required")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
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
        new ApiResponse(200,user,"Account details updated successfully")
    )

})
const updateUserAvatar = asyncHandler(async (req,res) => {
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")
    return res
        .status(200)
        .json(new ApiResponse(200,user,"Avatar image update successfully"))
    
})

const updateUserCoverImage = asyncHandler(async (req,res) => {
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover Image file is missing")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading on coverimage")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new:true}
    ).select("-password")
    return res
        .status(200)
        .json(new ApiResponse(200,user,"Cover image update successfully"))
})


// const checkOnline = asyncHandler( async (req, res) => {
//     try {
//       const { username } = req.user;
//       const user = await User.findOne({ username });
//       if (user) {
//         res.json({ online: user.online });
//       } else {
//         res.status(404).send('User not found');
//       }
//     } catch (error) {
//       res.status(500).send('Error checking online status');
//     }
// });

// // Calculate Total Time Excluding Away Periods
// const totalTime = asyncHandler( async (req, res) => {
//     try {
//       const { username } = req.user;
//       const user = await User.findOne({ username });
//       if (!user || !user.lastLoginTime || !user.lastLogoutTime) {
//         return res.status(404).send('User not found or session data incomplete');
//       }
  
//       const loginTime = new Date(user.lastLoginTime);
//       const logoutTime = new Date(user.lastLogoutTime);
//       const totalSessionTime = logoutTime - loginTime; // Total session time in milliseconds
  
//       // Calculate total away time
//       let totalAwayTime = 0;
//       for (const period of user.awayPeriods) {
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
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
    //checkOnline
}