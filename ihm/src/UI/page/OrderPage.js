import {withErrorCaught} from "../../utils/withErrorCaught";
import inventory from "../../domain/inventory.json"
import ProductDisplay from "../common/ProductDisplay";
import {Box} from "@mui/material";

function OrderPage({}) {
    return <Box className={"order-page"}>
        <Box sx={{
          display:"flex",
          alignItems : "center",
            
        }}>
            <h2>Les Oeufs du Magasin</h2>
            
        </Box>

        <div className={"content"}>
            {inventory.products.map((product, i) => <ProductDisplay key={i} product={product}/>)}
        </div>
    </Box>
}

export default withErrorCaught(OrderPage)
