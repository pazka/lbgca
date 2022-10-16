class Product{
    name
    description : string[]
    images : string[]
    variants : string[]
}

class Order{
    id :number
    product : string
    amount :number
    variant: string
    validated : boolean
    user : any
    user_id : number
}

class Variant {
    name
    colors : string[]
}