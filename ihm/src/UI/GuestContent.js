import {Route, Routes} from "react-router-dom";
import {Box} from "@mui/material";
import * as React from "react";
import HomePage from "./page/HomePage";
import LoginForm from "./common/LoginForm";

const GuestContent = () => {
    return <div className={"app-content"}>
        <Box className={"main-frame"}>
            <Routes>
                <Route path="/" element={<HomePage/>}/>
                <Route path={"/*"} element={<Box sx={{
                    width: "min(300px,100%)",
                    margin: "auto"
                }}>
                    <LoginForm/>
                </Box>}/>
            </Routes>
        </Box>
    </div>
}

export default GuestContent
