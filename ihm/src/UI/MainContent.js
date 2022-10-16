import {Route, Routes} from "react-router-dom";
import UserPage from "./page/UserPage";

import LoginForm from "./common/LoginForm";
import OrderPage from "./page/OrderPage";
import {useSelector} from "react-redux";
import {Box} from "@mui/material";

const MainContent = () => {
    const session = useSelector(store => store.userSlice)

    if (!session['profile']) {
        return <Box sx={{
            width: "min(300px,100%)",
            margin: "auto"
        }}>
            <LoginForm/>
        </Box>
    }

    return <>
        <Box sx={{
            width: "min(1000px,100%)",
            margin: "auto"
        }}>
            <Routes>
                <Route path="/" element={<OrderPage/>}/>
                <Route path="/user/:id" element={<UserPage/>}/>
            </Routes>
        </Box>
    </>
}

export default MainContent
