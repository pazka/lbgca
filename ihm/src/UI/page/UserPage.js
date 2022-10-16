import UserDetail from "../common/user/UserDetail";
import {useParams} from "react-router-dom";
import {withErrorCaught} from "../../utils/withErrorCaught";

import UserEdit from "../common/user/UserEdit";
import {useDispatch, useSelector} from "react-redux";

function UserPage({}) {
    let {id} = useParams();
    const session = useSelector(store => store.userSlice)
    const dispatch = useDispatch()

    return <div>
        <UserDetail userId={id}/>
        {session.connected && (session.username === id) && <UserEdit userId={id}/>}
    </div>
}

export default withErrorCaught(UserPage)
