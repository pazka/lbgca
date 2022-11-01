import {Route, Routes} from "react-router-dom";
import UserPage from "./page/UserPage";

import LoginForm from "./common/LoginForm";
import OrderPage from "./page/OrderPage";
import {useSelector} from "react-redux";
import {Box} from "@mui/material";
import * as React from "react";
import MyBasketPage from "./page/MyBasketPage";
import ValidatedBasketsPage from "./page/ValidatedBasketsPage";
import HomePage from "./page/HomePage";

const MainContent = () => {
    const session = useSelector(store => store.userSlice)

    return <div className={"app-content"}>
        <Box className={"main-frame"}>
            <Routes>
                <Route path="/" element={<HomePage/>}/>
                <Route path="/products" element={<OrderPage/>}/>
                <Route path="/all" element={<ValidatedBasketsPage/>}/>
                <Route path="/user/:id" element={<UserPage/>}/>
                <Route path="/myBasket" element={<MyBasketPage/>}/>
            </Routes>
        </Box>
    </div>
}

export default MainContent
