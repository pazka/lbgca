import {useEffect, useState} from "react";
import {apiGetUserComments} from "../../../services/rest-com/endpoints/userEndpoints";
import {withErrorCaught} from "../../../utils/withErrorCaught";
import CommentList from "../comment/CommentList";

function UserComments({userId}) {
    const [comments, setComments] = useState([])

    useEffect(() => {
        if (userId) {
            apiGetUserComments(userId).then(res => {
                if (res.error) {
                    setComments([])
                }

                setComments(res)
            })
        }
    }, [userId])

    if (!userId)
        return null

    if (!comments.length)
        return <p>No comment yet ! </p>
    
    return <div style={{display: "flex", flexWrap: "wrap"}}>
        <CommentList comments={comments}/>
    </div>
}

export default withErrorCaught(UserComments)
