import {withErrorCaught} from "../../utils/withErrorCaught";
import {useEffect, useState} from "react";
import inventory from "../../domain/inventory.json"
import ProductDisplay from "../common/ProductDisplay";

function OrderPage({}) {
    return <div className={"order-page"}>
        <h2>Les Oeufs du Magasin</h2>
        <div className={"content"}>
            {inventory.products.map((product, i) => <ProductDisplay key={i} product={product}/>)}
        </div>
    </div>
}

export default withErrorCaught(OrderPage)
