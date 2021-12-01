const Shopify = require("shopify-api-node");
const { encrypt, decrypt } = require("../y-core-crypto");

class ShopifyRegistry {
  #dbPool;
  #SHOPIFY_API_SECRET_KEY;
  #API_VERSION;
  #shopifySingletons;
  #Shopify;

  constructor(dbPool, Shopify) {
    this.#shopifySingletons = new Map();
    this.#dbPool = dbPool;
    this.#SHOPIFY_API_SECRET_KEY = Shopify.Context.API_SECRET_KEY;
    this.#API_VERSION = Shopify.Context.API_VERSION;
    this.#Shopify = Shopify;
  }

  get dbPool() {
    return this.#dbPool;
  }

  get Shopify() {
    return this.#Shopify;
  }

  async getCurrentSession(ctx) {
    return await this.#Shopify.Utils.loadCurrentSession(ctx.req, ctx.res);
  }

  initShopifyAPIWithAccessToken(shop_domain, accessToken) {
    if (!accessToken) return undefined;
    let shopify = this.#shopifySingletons.get(shop_domain);
    if (!shopify) {
      shopify = this.#createNewInstance(shop_domain, accessToken);
    } else {
      // try {
        const __accessToken = shopify.options.accessToken;
        if (__accessToken !== accessToken)
          shopify = this.#createNewInstance(shop_domain, accessToken); //if accessToken changed due to reinstall
      // } catch (error) {
      //   throw error;
      // }
    }
    return shopify;
  }

  async initShopifyAPI(shop_domain) {
    const accessToken = await this.getDecryptedAccessToken(shop_domain);
    return this.initShopifyAPIWithAccessToken(shop_domain, accessToken);
  }

  getEncryptedAccessTokenAndIv(accessToken) {
    let encryptedData = encrypt(accessToken, this.#SHOPIFY_API_SECRET_KEY);
    let iv = encryptedData.iv;
    let _accessToken = encryptedData.encryptedData;
    return { _accessToken, iv };
  }

  decryptAccessToken(encryptedAccessToken, iv) {
    return decrypt(encryptedAccessToken, iv, this.#SHOPIFY_API_SECRET_KEY);
  }

  async getDecryptedAccessToken(shop_domain) {
    const SQL_ACCESS_TOKEN =
      "SELECT access_token, iv FROM shops WHERE shop_domain = ?";
    const result = await this.#dbPool.query(SQL_ACCESS_TOKEN, [shop_domain]);
    if (result && result.length == 1) {
      //okay we have an access token
      let encryptedAccessToken = result[0].access_token;
      let iv = result[0].iv;
      return this.decryptAccessToken(encryptedAccessToken, iv);
    } else return undefined;
  }

  #createNewInstance(shop_domain, accessToken) {
    var shopify = undefined;
    const params = {
      shopName: shop_domain,
      accessToken: accessToken,
      apiVersion: this.#API_VERSION,
      autoLimit: { calls: 1, interval: 1100, bucketSize: 15 },
    };
    shopify = new Shopify(params);
    this.#shopifySingletons.set(shop_domain, shopify);
    return shopify;
  }
}

module.exports = ShopifyRegistry;
