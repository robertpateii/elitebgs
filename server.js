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

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const logger = require('morgan');
const bodyParser = require('body-parser');
const session = require('express-session');
const mongoStore = require('connect-mongo')(session);
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const secrets = require('./secrets');
const processVars = require('./processVars');

const bugsnagClientMiddleware = require('./server/bugsnag').getPlugin('express');
const swagger = require('./server/swagger');

const ebgsFactionsV1 = require('./server/routes/elite_bgs_api/v1/factions');
const ebgsSystemsV1 = require('./server/routes/elite_bgs_api/v1/systems');

const ebgsFactionsV2 = require('./server/routes/elite_bgs_api/v2/factions');
const ebgsSystemsV2 = require('./server/routes/elite_bgs_api/v2/systems');

const ebgsFactionsV3 = require('./server/routes/elite_bgs_api/v3/factions');
const ebgsSystemsV3 = require('./server/routes/elite_bgs_api/v3/systems');

const ebgsFactionsV4 = require('./server/routes/elite_bgs_api/v4/factions');
const ebgsSystemsV4 = require('./server/routes/elite_bgs_api/v4/systems');
const ebgsStationsV4 = require('./server/routes/elite_bgs_api/v4/stations');
const tickTimesV4 = require('./server/routes/elite_bgs_api/v4/tick_times');

const authCheck = require('./server/routes/auth/auth_check');
const authDiscord = require('./server/routes/auth/discord');
const authLogout = require('./server/routes/auth/logout');
const authUser = require('./server/routes/auth/auth_user');
const frontEnd = require('./server/routes/front_end');
const chartGenerator = require('./server/routes/chart_generator');

require('./server/modules/eddn');
require('./server/modules/discord');
require('./server/modules/tick/listener');

const app = express();

app.use(bugsnagClientMiddleware.requestHandler);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'dist')));
app.use(session({
    name: "EliteBGS",
    secret: secrets.session_secret,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
    store: new mongoStore({ mongooseConnection: require('./server/db').elite_bgs })
}));
app.use(passport.initialize());
app.use(passport.session());

app.use('/api/ebgs/v1/api-docs.json', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swagger.EBGSAPIv1);
});

app.use('/api/ebgs/v2/api-docs.json', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swagger.EBGSAPIv2);
});

app.use('/api/ebgs/v3/api-docs.json', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swagger.EBGSAPIv3);
});

app.use('/api/ebgs/v4/api-docs.json', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swagger.EBGSAPIv4);
});

app.use('/api/ebgs/v1/docs', swaggerUi.serve, swaggerUi.setup(swagger.EBGSAPIv1));
app.use('/api/ebgs/v2/docs', swaggerUi.serve, swaggerUi.setup(swagger.EBGSAPIv2));
app.use('/api/ebgs/v3/docs', swaggerUi.serve, swaggerUi.setup(swagger.EBGSAPIv3));
app.use('/api/ebgs/v4/docs', swaggerUi.serve, swaggerUi.setup(swagger.EBGSAPIv4));

app.use('/api/ebgs/v4/factions', ebgsFactionsV4);
app.use('/api/ebgs/v4/systems', ebgsSystemsV4);
app.use('/api/ebgs/v4/stations', ebgsStationsV4);
app.use('/api/ebgs/v4/ticks', tickTimesV4);

app.use('/auth/check', authCheck);
app.use('/auth/discord', authDiscord);
app.use('/auth/logout', authLogout);
app.use('/auth/user', authUser);
app.use('/frontend', frontEnd);
app.use('/chartgenerator', chartGenerator);

// Pass all 404 errors called by browser to angular
app.all('*', (req, res) => {
    console.log(`Server 404 request: ${req.originalUrl}`);
    res.status(200).sendFile(path.join(__dirname, 'dist', 'index.html'))
});

// error handlers
app.use(bugsnagClientMiddleware.errorHandler);

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(logger('dev'));
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.send({
            message: err.message,
            error: err
        });
        console.log(err);
    });
}

// production error handler
// no stacktraces leaked to user
if (app.get('env') === 'production') {
    app.use(logger('combined'));
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.send({
            message: err.message,
            error: {}
        });
    });
}

passport.serializeUser(function (user, done) {
    done(null, user.id);
});
passport.deserializeUser(function (id, done) {
    require('./server/models/ebgs_users')
        .then(model => {
            model.findOne({ id: id })
                .then(user => {
                    done(null, user);
                })
                .catch(err => {
                    bugsnagClientMiddleware.notify(err, {
                        user: { id: id }
                    })
                    done(err);
                })
        })
        .catch(err => {
            bugsnagClientMiddleware.notify(err, {
                user: { id: id }
            })
            done(err);
        })
});

let onAuthentication = (accessToken, refreshToken, profile, done, type) => {
    const client = require('./server/modules/discord/client');
    const config = require('./server/models/configs');
    require('./server/models/ebgs_users')
        .then(model => {
            model.findOne({ id: profile.id })
                .then(user => {
                    if (user) {
                        let updatedUser = {
                            id: profile.id,
                            username: profile.username,
                            discriminator: profile.discriminator
                        }
                        if (user.avatar || user.avatar === null) {
                            updatedUser.avatar = profile.avatar
                        }
                        model.findOneAndUpdate(
                            { id: profile.id },
                            updatedUser,
                            {
                                upsert: false,
                                runValidators: true
                            })
                            .then(() => {
                                done(null, user);
                            })
                            .catch(err => {
                                done(err);
                            });
                    } else {
                        config.then(configModel => {
                            configModel.findOne()
                                .then(config => {
                                    let invite = client.guilds.get(config.guild_id).channels.get(config.invite_channel_id).createInvite({
                                        maxAge: 0,
                                        maxUses: 1,
                                        unique: true
                                    });
                                    invite.then(invitePromise => {
                                        let user = {
                                            id: profile.id,
                                            username: profile.username,
                                            avatar: profile.avatar,
                                            discriminator: profile.discriminator,
                                            access: 1,
                                            os_contribution: 0,
                                            patronage: {
                                                level: 0,
                                                since: null
                                            },
                                            invite: invitePromise.code,
                                            invite_used: false
                                        };
                                        model.findOneAndUpdate(
                                            { id: profile.id },
                                            user,
                                            {
                                                upsert: true,
                                                runValidators: true
                                            })
                                            .then(() => {
                                                client.guilds.get(config.guild_id).channels.get(config.admin_channel_id).send("User " + profile.id + " has joined Elite BGS");
                                                done(null, user);
                                            })
                                            .catch(err => {
                                                done(err);
                                            });
                                    })
                                })
                                .catch(err => {
                                    done(err);
                                })
                        }).catch(err => {
                            done(err);
                        });
                    }
                })
        })
        .catch(err => {
            done(err);
        })
}

let onAuthenticationIdentify = (accessToken, refreshToken, profile, done) => {
    onAuthentication(accessToken, refreshToken, profile, done, 'identify');
}

passport.use('discord', new DiscordStrategy({
    clientID: secrets.client_id,
    clientSecret: secrets.client_secret,
    callbackURL: `${processVars.protocol}://${processVars.host}/auth/discord/callback`,
    scope: ['identify']
}, onAuthenticationIdentify));

module.exports = app;
