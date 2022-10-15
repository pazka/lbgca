import {useEffect, useState} from "react";
import {apiGetUserDrawings} from "../../../services/rest-com/endpoints/userEndpoints";
import {withErrorCaught} from "../../../utils/withErrorCaught";
import DrawingList from "../drawing/DrawingList";

function UserDrawings({userId}) {
    const [drawings, setDrawings] = useState([])

    useEffect(() => {
        if (userId) {
            apiGetUserDrawings(userId).then(res => {
                if (res.error) {
                    setDrawings([])
                }

                setDrawings(res)
            })
        }
    }, [userId])

    if (!userId)
        return null
    
    if (!drawings.length)
        return <p>No drawing yet ! </p> 

    return <div style={{display: "flex", flexWrap: "wrap"}}><DrawingList drawings={drawings}/></div>
}

export default withErrorCaught(UserDrawings)
