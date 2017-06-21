/*
 * KodeBlox Copyright 2017 Sayak Mukhopadhyay
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http: //www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

module.exports = new Promise((resolve, reject) => {
    let db = require('../db');
    let mongoose = db.mongoose;
    let Schema = mongoose.Schema;

    let station = new Schema({
        id: { type: Number, unique: true },
        name: String,
        name_lower: { type: String, lowercase: true },
        system_id: { type: Number, ref: 'system.id' },
        updated_at: Date,
        max_landing_pad_size: { type: String, lowercase: true },
        distance_to_star: Number,
        government_id: Number,
        government: { type: String, lowercase: true },
        allegiance_id: Number,
        allegiance: { type: String, lowercase: true },
        state_id: Number,
        state: { type: String, lowercase: true },
        type_id: Number,
        type: { type: String, lowercase: true },
        has_blackmarket: Boolean,
        has_market: Boolean,
        has_refuel: Boolean,
        has_repair: Boolean,
        has_rearm: Boolean,
        has_outfitting: Boolean,
        has_shipyard: Boolean,
        has_docking: Boolean,
        has_commodities: Boolean,
        import_commodities: [{ type: String, lowercase: true }],
        export_commodities: [{ type: String, lowercase: true }],
        prohibited_commodities: [{ type: String, lowercase: true }],
        economies: [{ type: String, lowercase: true }],
        shipyard_updated_at: Date,
        outfitting_updated_at: Date,
        market_updated_at: Date,
        is_planetary: Boolean,
        selling_ships: [{ type: String, lowercase: true }],
        selling_modules: [Number],
        settlement_size_id: Number,
        settlement_size: { type: String, lowercase: true },
        settlement_security_id: Number,
        settlement_security: { type: String, lowercase: true },
        body_id: { type: Number, ref: 'body.id' },
        controlling_minor_faction_id: { type: Number, ref: 'faction.id' }
    });

    station.pre('save', function(next) {
        this.updated_at *= 1000;
        this.name_lower = this.name;
        if (this.shipyard_updated_at) {
            this.shipyard_updated_at *= 1000;
        }
        if (this.outfitting_updated_at) {
            this.outfitting_updated_at *= 1000;
        }
        if (this.market_updated_at) {
            this.market_updated_at *= 1000;
        }
        next();
    });

    station.pre('findOneAndUpdate', function(next) {
        this._update.updated_at *= 1000;
        this._update.name_lower = this._update.name;
        if (this._update.shipyard_updated_at) {
            this._update.shipyard_updated_at *= 1000;
        }
        if (this._update.outfitting_updated_at) {
            this._update.outfitting_updated_at *= 1000;
        }
        if (this._update.market_updated_at) {
            this._update.market_updated_at *= 1000;
        }
        next();
    });

    let model = mongoose.model('station', station);

    resolve(model);
})