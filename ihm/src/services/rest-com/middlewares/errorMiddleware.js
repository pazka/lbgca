import {isEmpty} from "../../Utils/type-ops";

export const errorIngoingMiddleware = (response) => {
    if(!response)
        return response
    
    if (("" + response.status)[0] !== "2") {
        if (!isEmpty(response.data)) {
            console.error(response.data, response)
        } else {
            console.error(response)
        }
    }

    return response
}

export const errorOutgoingMiddleware = (request) => {
    return request
}
