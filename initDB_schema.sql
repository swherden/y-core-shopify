CREATE TABLE `shops` (
  `shop_domain` varchar(256) NOT NULL,
  `shop_id` varchar(45) NOT NULL,
  `shop_country` varchar(5) DEFAULT NULL,
  `currency` varchar(45) DEFAULT NULL,
  `to_be_deleted` tinyint(4) NOT NULL DEFAULT '0',
  `access_token` varchar(256) DEFAULT NULL,
  `iv` varchar(100) DEFAULT NULL,
  `uninstall_request_at` datetime DEFAULT NULL,
  `recommended_by` varchar(45) DEFAULT NULL,
  `created_at` datetime NOT NULL,
  `scope` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`shop_domain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
CREATE TABLE `job_locks` (
  `shop_domain` varchar(256) NOT NULL,
  `job_type` varchar(200) NOT NULL,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`shop_domain`,`job_type`)
) ENGINE=MEMORY DEFAULT CHARSET=latin1;
CREATE TABLE `sessions` (
  `session_id` varchar(256) NOT NULL,
  `expires_at` datetime DEFAULT NULL,
  `sessionInfo` json DEFAULT NULL,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
CREATE TABLE `subscriptions` (
  `subscription_id` int(11) NOT NULL AUTO_INCREMENT,
  `shop_domain` varchar(256) NOT NULL,
  `plan_id` int(11) NOT NULL,
  `shopify_charge_id` varchar(45) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `activated_at` datetime DEFAULT NULL,
  `canceled_at` datetime DEFAULT NULL,
  PRIMARY KEY (`subscription_id`)
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8;
CREATE TABLE `subscription_plan` (
  `plan_id` int(11) NOT NULL AUTO_INCREMENT,
  `terms` varchar(45) NOT NULL,
  `capped_amount` decimal(19,4) DEFAULT '0.0000',
  `name` varchar(45) NOT NULL,
  `recurring_price` decimal(19,4) NOT NULL DEFAULT '0.0000',
  `usage_price` decimal(19,4) NOT NULL DEFAULT '0.0000',
  `capped_transactions` int(6) NOT NULL DEFAULT '50',
  `transactions_included` int(6) NOT NULL DEFAULT '0',
  PRIMARY KEY (`plan_id`)
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8;
INSERT INTO subscription_plan (
`terms`,
`capped_amount`,
`name`,
`recurring_price`,
`usage_price`,
`capped_transactions`,
`transactions_included`) 
VALUES ('FREE',0,'FREE',0,0,0,0);
