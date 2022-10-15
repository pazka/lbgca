import {Route, Routes} from "react-router-dom";
import UserPage from "./page/UserPage";
import useSession from "../utils/useSession";
import LoginForm from "./common/LoginForm";

const MainContent = () => {
    const [session] = useSession()
    
    if(!session['connected']){
        return <div style={{
            width : "66%",
            margin : "auto"
        }}><LoginForm/>
        </div>
    }
    return <>
        <div style={{
            width : "66%",
            margin : "auto"
        }}>
            <Routes>
                <Route path="/" element={<p>OK</p>}/>
                <Route path="/user/:id" element={<UserPage/>}/>
            </Routes>
        </div>
    </>
}

export default MainContent
