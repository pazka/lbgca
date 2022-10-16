import './App.css';
import MainContent from "./UI/MainContent";
import Header from "./UI/common/Header";
import Footer from "./UI/common/Footer";
import {useEffect} from "react";
import {useDispatch} from "react-redux";
import {initInventory} from "./StateManagement/initEffects";

function App() {
    const dispatch = useDispatch()
    
    useEffect(()=>{
        dispatch(initInventory())
    })
    
    return (
            <div>
                <Header/>
                <MainContent/>
                <Footer/>
            </div>
    );
}

export default App;
