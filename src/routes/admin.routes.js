import {Router} from "express";
import { registerAdmin ,loginAdmin,logoutAdmin,refreshAccessToken} from "../controllers/admin.controller.js";
import { upload } from "../middleware/multer.middleware.js";
import { verifyJwt } from "../middleware/auth.middleware.js";

const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
        
    ]),
    registerAdmin
)
router.route("/login").post(loginAdmin)
router.route("/logout").post(verifyJwt,logoutAdmin)
router.route("/refresh-token").post(refreshAccessToken)
//router.route("/check-online").get(verifyJwt,checkOnline)
export default router