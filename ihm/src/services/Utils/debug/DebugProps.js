import React, {useEffect} from 'react'
import {styled} from "@mui/material";
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
        overflow : "auto",
        width : "500px",
        height : "500px",
        transition : "0.5s all"
    }
}))


export interface DebugPropsProps {
    style?: any,
    position:any,
    props:any
}

/**
 * Can be used to easily and dynamically display the properties of an object for quick debug
 * It include a safeguard to not display itself if instanciated in production environment
 * 
 * @example <DebugProps props={someState}/>
 * 
 * @param style
 * @param position
 * @param props
 * @returns {JSX.Element|null}
 * @constructor
 */
const DebugProps = (
    {
        style = {},
        position={},
        props={}
    }: DebugPropsProps) => {
    useEffect(()=>{},props)

    if(!config.debug){
        return null
    }

    return <StyleWrapper style={{...style,...position}}>
        {JSON.stringify(props, ' ', 1)}
    </StyleWrapper>
}

export default React.memo(DebugProps)
