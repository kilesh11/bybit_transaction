import * as dotenv from "dotenv";
dotenv.config();
import crypto from "crypto";
import axios from "axios";
import qs from "qs";

const api_key = process.env.API_KEY ?? "";
const secret = process.env.API_SECRET ?? "";

const apiUrl = "https://api.bybit.com";
const orderBook = "/spot/quote/v1/depth";
// const bestAskPrice = "/spot/quote/v1/ticker/book_ticker";
const orderBalance = "/spot/v1/account";
const placeOrderUrl = "/spot/v1/order";
const serverTimeUrl = "/spot/v1/time";

const timeout = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getSignature = (parameters: object, secret: string) => {
    var orderedParams = "";
    Object.keys(parameters)
        .sort()
        .forEach(function (key: string) {
            // @ts-ignore: Unreachable code error
            orderedParams += key + "=" + parameters[key] + "&";
        });
    orderedParams = orderedParams.substring(0, orderedParams.length - 1);

    return crypto.createHmac("sha256", secret).update(orderedParams).digest("hex");
};

const getBalance = async () => {
    const params = { timestamp: Date.now(), api_key };
    const { data: balance } = await axios.get(`${apiUrl}${orderBalance}`, {
        params: { ...params, sign: getSignature(params, secret) }
    });
    console.dir(balance.result.balances);
};

const getServerTime = async () => {
    const { data } = await axios.get(`${apiUrl}${serverTimeUrl}`);
    return data.result.serverTime;
};

const placeOrder = async (price: string, qty: number, symbol: string, side: "Sell" | "Buy") => {
    const floatPrice = parseFloat(price);
    const finalPrice = side === "Buy" ? (floatPrice * 1.05).toFixed(2) : floatPrice.toFixed(2);
    console.dir(floatPrice);
    const timestamp = await getServerTime();
    const params = {
        timestamp,
        api_key,
        side,
        symbol,
        type: "LIMIT",
        qty,
        timeInForce: "IOC",
        price: finalPrice
    };
    const sign = getSignature(params, secret);
    const config = {
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    };
    const { data: order } = await axios.post(
        `${apiUrl}${placeOrderUrl}`,
        qs.stringify({ ...params, sign }),
        config
    );
    console.dir(order);
};

const getOrderBook = async (symbol: string, qty: number, side: "Buy" | "Sell") => {
    const orderBookparams = { symbol, limit: "1" };
    try {
        const { data } = await axios.get(`${apiUrl}${orderBook}`, {
            params: { ...orderBookparams }
        });
        // console.dir(data);
        if (data.result.asks.length > 0) {
            console.dir(
                `Ask Price: ${data.result.asks[0][0]} Bid Price: ${data.result.bids[0][0]}`
            );
            const price = side === "Buy" ? data.result.asks[0][0] : data.result.bids[0][0];
            // await placeOrder(price, qty, symbol, side);
            // await getBalance();
            return false;
        }
        console.log(`no ${symbol} order book yet`);
        return false;
    } catch (err) {
        console.log(`Error in getting order Book`);
        return false;
    }
};

(async () => {
    let finish = false;
    while (!finish) {
        const [haveOrder] = await Promise.all([getOrderBook("REALUSDT", 5, "Sell"), timeout(1250)]);
        finish = haveOrder;
    }
})().catch((err) => {
    console.error(err);
});
