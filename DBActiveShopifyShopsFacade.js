const { default: log, errorLog } = require("../y-core-loghandler");
const TOPIC = "Y-CORE-SHOPIFY-INSTALL";

class DBActiveShopifyShopsFacade {
  #dbPool;
  #shopifyRegistry;

  constructor(shopifyRegistry) {
    this.#shopifyRegistry = shopifyRegistry;
    this.#dbPool = shopifyRegistry.dbPool;
  }

  async installShop(context, shop_domain, scope, accessToken) {
    const affiliatePartner = this.#getAffiliatePartner(context);
    log("Shop was recommended by: " + affiliatePartner, shop_domain, TOPIC);
    try {
      const SQL_SHOP_INSTALLED = "SELECT * FROM shops WHERE shop_domain=?";
      const shopData = await this.#dbPool.query(SQL_SHOP_INSTALLED, [
        shop_domain,
      ]);
      if (shopData && shopData.length == 0) {
        //new shop
        await this.#loadMetaDataAndPersistShop(
          shop_domain,
          accessToken,
          affiliatePartner,
          scope,
          false
        );
      } else if (shopData.length == 1 && shopData[0].to_be_deleted == 1) {
        //old shop
        // shop deleted and newly installed
        await this.#deleteAndInstallShop(
          shop_domain,
          accessToken,
          affiliatePartner,
          scope
        );
      }
      // else do nothing - user already installed shop and installed it again --> no problem
    } catch (err) {
      console.log("INSTALL_SHOP",err);
      errorLog(err, shop_domain, TOPIC + ".installNewShop");
    }
  }

  async uninstallShop(shop_domain) {
    const result = await this.#dbPool.query(
      "SELECT shop_domain from shops where shop_domain =?",
      [shop_domain]
    );
    if (result && result.length == 1) {
      //shop will not be uninstalled directly --> only a mark is set. The shop will be deleted 30 days after request (recommendation from Shopify)
      log("Mark shop to be deleted", shop_domain, TOPIC);
      this.#deleteShopFromDB(shop_domain);
      this.#cancelSubscription(shop_domain);
    }
    //no entry found! Give shopify a 200 and try to delete rest later
  }

  async isShopActive(shop_domain) {
    const SQL_IS_ACTIVE =
      "SELECT shops.shop_domain FROM shops, subscriptions where shops.shop_domain = subscriptions.shop_domain AND subscriptions.activated_at is not null AND subscriptions.canceled_at is null AND shops.to_be_deleted = 0 AND shops.shop_domain = ?";
    const result = await this.#dbPool.query(SQL_IS_ACTIVE, [shop_domain]);
    var isActive = false;
    if (result) {
      if (result.length > 1) {
        errorLog("shop misconfigured", shop_domain, TOPIC + ".isActiveShop");
        isActive = true;
      }
      if (result.length === 1) isActive = true;
    }
    return isActive;
  }

  async reactivateWebhookHandlersAfterRestart(reactivateCallback) {
    const SQL_ACTIVE_SHOPS =
      "SELECT shops.shop_domain, iv, access_token as accessToken FROM shops, subscriptions where shops.shop_domain = subscriptions.shop_domain AND subscriptions.activated_at is not null AND subscriptions.canceled_at is null AND shops.to_be_deleted = 0";
    const result = await this.#dbPool.query(SQL_ACTIVE_SHOPS);
    if (result && result.length > 0) {
      for (const shop of result) {
        const { shop_domain, iv, accessToken } = shop;
        reactivateCallback(
          shop_domain,
          this.#shopifyRegistry.decryptAccessToken(accessToken, iv)
        );
      }
    }
  }

  #deleteShopFromDB(shop_domain) {
    const sql =
      "UPDATE shops SET to_be_deleted = 1, uninstall_request_at = now() WHERE shop_domain=?";
    this.#dbPool.query(sql, [shop_domain], function (err, result) {
      if (err) {
        errorLog("Cannot mark shop deletion: " + err, shop_domain, TOPIC);
        return;
      }
      log("SUCCESS - Shop marked to be deleted!", shop_domain, TOPIC);
    });
  }

  #cancelSubscription(shop_domain) {
    this.#dbPool.query(
      "UPDATE subscriptions SET canceled_at = now() WHERE subscriptions.shop_domain=?",
      [shop_domain],
      function (err, result) {
        if (err) {
          errorLog(
            "Cannot mark subscription deletion: " + err,
            shop_domain,
            TOPIC
          );
          return;
        }
        log("SUCCESS - Subscription marked to be deleted!", shop_domain, TOPIC);
      }
    );
  }

  async #deleteAndInstallShop(
    shop_domain,
    accessToken,
    affiliatePartner,
    scope
  ) {
    log("deleteAndInstallNew", shop_domain, TOPIC);
    try {
      log("TryToDelete and then install new", shop_domain, TOPIC);
      // delete shop data before adding new
      const response = await this.#dbPool.query(
        "DELETE FROM shops WHERE shop_domain=?",
        [shop_domain]
      );
      if (response && response.affectedRows > 0) {
        this.#loadMetaDataAndPersistShop(
          shop_domain,
          accessToken,
          affiliatePartner,
          scope,
          true
        );
      }
    } catch (error) {
      errorLog("cannot delete shop", shop_domain, TOPIC);
    }
  }

  async #loadMetaDataAndPersistShop(
    shop_domain,
    accessToken,
    affiliatePartner,
    scope,
    isOldShop
  ) {
    const shopData = await this.#getShopMetaData(shop_domain, accessToken);
    if (shopData)
      await this.#persistShopToDB(
        shopData,
        affiliatePartner,
        accessToken,
        shop_domain,
        scope,
        isOldShop
      );
  }

  async #persistShopToDB(
    shopData,
    affiliatePartner,
    accessToken,
    shop_domain,
    scope,
    isOldShop
  ) {
    try {
      const { id, country, currency } = shopData;
      let _affiliatePartner = null;
      if (affiliatePartner) _affiliatePartner = affiliatePartner;
      //save data to db
      const {
        _accessToken,
        iv,
      } = this.#shopifyRegistry.getEncryptedAccessTokenAndIv(accessToken);
      log("shop_id: " + id, shop_domain, TOPIC);
      const SQL_INSERT_SHOP =
        "INSERT INTO shops (shop_id, shop_domain, shop_country, currency, access_token, iv, recommended_by, created_at, scope) VALUES ?";
      let values = [
        [
          id,
          shop_domain,
          country,
          currency,
          _accessToken,
          iv,
          _affiliatePartner,
          new Date(),
          scope,
        ],
      ];
      const result = await this.#dbPool.query(SQL_INSERT_SHOP, [values]);
      log("New shop added, ID: " + result.insertId, shop_domain, TOPIC);
      await this.#saveFreePlan(shop_domain, isOldShop);
    } catch (error) {
      errorLog("cannot persist shop " + error, shop_domain, TOPIC);
    }
  }

  async #saveFreePlan(shop_domain, isOldShop) {
    if (!isOldShop) {
      try {
        //reuse old plan if only shop is reactivated
        // create Free plan for new shop and activate without chargeid
        let createNewPlanForShop =
          "INSERT INTO subscriptions (shop_domain, plan_id, created_at, activated_at, shopify_charge_id) VALUES ?";
        const now = new Date().getTime();
        let values = [
          [shop_domain, 1, new Date(), new Date(), "internal_" + now],
        ];
        const result = await this.#dbPool.query(createNewPlanForShop, [values]);
        if (result)
          log("New plan added, ID: " + result.insertId, shop_domain, TOPIC);
      } catch (error) {
        errorLog(
          "cannot save free plan for new shop " + error,
          shop_domain,
          TOPIC
        );
      }
    } else {
      try {
        const SQL_ACTIVATED_AT =
          "SELECT activated_at FROM subscriptions, subscription_plan WHERE subscriptions.plan_id = subscription_plan.plan_id AND subscriptions.activated_at IS NOT NULL AND subscriptions.canceled_at IS NULL AND subscriptions.shop_domain = ?";
        const result = await this.#dbPool.query(SQL_ACTIVATED_AT, [
          shop_domain,
        ]);
        if (result && result.length > 0) {
          activated_at = result[0].activated_at;
          log("WARN - Plan already active", shop_domain, TOPIC);
        } else {
          //shop is reactivated, but has no plan --> create one
          this.#saveFreePlan(shop_domain, false);
        }
      } catch (error) {
        errorLog(
          "cannot save free plan for reactivated shop " + error,
          shop_domain,
          TOPIC
        );
      }
    }
  }

  async #getShopMetaData(shop_domain, accessToken) {
    try {
      const shopify = this.#shopifyRegistry.initShopifyAPIWithAccessToken(
        shop_domain,
        accessToken
      );
      const shopData = await shopify.shop.get([]);
      return shopData;
    } catch (error) {
      errorLog("Error during fetch shop data. " + error, shop_domain, TOPIC);
      console.log(error);
    }
    return undefined;
  }

  #getAffiliatePartner(context, shop) {
    var affiliatePartner = context.cookies.get("_sthx");
    if (affiliatePartner) {
      affiliatePartner = "" + affiliatePartner;
      if (affiliatePartner.includes("?")) {
        //sometimes some query params are added
        var affArray = affiliatePartner.split("?");
        affiliatePartner = affArray[0];
      }
    }
    return affiliatePartner;
  }
}

module.exports = DBActiveShopifyShopsFacade;
