import React from 'react'
import {styled} from "@mui/material";
import {useSelector} from "react-redux";
import {isEmpty} from "../type-ops";
import {config} from "../../Services/config";

const StyleWrapper = styled('pre')(({theme}) => ({
    backgroundColor : "rgba(155,155,155,0.2)",
    border : "solid 1px red",
    position : "fixed",
    bottom : 0,
    right : 0,
    width : "10em",
    height : "10em",
    zIndex : 999,
    color : "black",
    transition : "0.5s all",
    "&:hover" : {
        width : "200px",
        height : "500px",
        transition : "0.5s all"
    }
}))


export interface DebugLoadingsProps {
    style?: any
}

/**
 * Can be used to continuously display the state of the loadings 
 * It include a safeguard to not display itself if instanciated in production environment
 *
 * @example <DebugLoadings>
 * 
 * @param style
 * @returns {JSX.Element|null}
 * @constructor
 */
const DebugLoadings = (
    {
        style = {}
    }: DebugLoadingsProps) => {

    const loadings : LoadingsState = useSelector(store => store.loadings)
    if(isEmpty(loadings)) {return null}
    if(!config.debug) {return null}

    return <StyleWrapper style={style}>
        {JSON.stringify(loadings, ' ', 1)}
    </StyleWrapper>
}

export default React.memo(DebugLoadings)
