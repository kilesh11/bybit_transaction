import * as dotenv from "dotenv";
dotenv.config();
import crypto from "crypto";
import axios from "axios";

const apiKey = process.env.API_KEY ?? "";
const secret = process.env.API_SECRET ?? "";
const timestamp = Date.now();
// const params = {
//     order_id: "876b0ac1-bafe-4110-b404-6a7c8211a6d9",
//     symbol: "BTCUSD",
//     timestamp: timestamp,
//     api_key: apiKey
// };

const apiUrl = "https://api.bybit.com";
const orderBook = "/v2/public/orderBook/L2";

function timeout(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSignature(parameters: object, secret: string) {
    var orderedParams = "";
    Object.keys(parameters)
        .sort()
        .forEach(function (key: string) {
            // @ts-ignore: Unreachable code error
            orderedParams += key + "=" + parameters[key] + "&";
        });
    orderedParams = orderedParams.substring(0, orderedParams.length - 1);

    return crypto.createHmac("sha256", secret).update(orderedParams).digest("hex");
}

const getOrderBook = async (symbol: string, side: "Buy" | "Sell") => {
    const params = {
        symbol
    };
    const sign = getSignature(params, secret);
    const { data } = await axios.get(`${apiUrl}${orderBook}`, { params: { ...params, sign } });
    // console.log(data);
    const buyData = data.result.filter((order: any) => order.side === "Buy");
    console.dir(buyData);
};

(async () => {
    while (true) {
        await Promise.all([getOrderBook("BITUSDT", "Buy"), timeout(1500)]);
    }
})().catch((err) => {
    console.error(err);
});
