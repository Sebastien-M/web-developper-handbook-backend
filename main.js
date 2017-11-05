const express = require('express');
const Client = require('mariasql');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cookieParser = require('cookie-parser');

let bodyParser = require('body-parser');
let app = express();

var c = new Client({
    host: '127.0.0.1',
    user: 'root',
    password: 'rga42fm',
    db: 'handbook'
});
app.use(cookieParser());
app.use(session({
    secret: "rga42fm1",
    resave: true,
    saveUninitialized: false,
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
  


app.get("/handbook", function (req, resp) {
    resp.status(200).send('welcome!');
});

//-----------------------------------------------------------ADD USER-------------------------------------------------------------
app.post("/handbook/user/new", function (req, resp) {
    let regis = registration_check(req.get('pseudo'), req.get('password'), req.get('email'));
    if (regis === true) {
        registration_check_two(req.get('email'), req.get('pseudo')).then(function (result) {
            if (result === true) {
                let pseudo = req.get('pseudo');
                let email = req.get('email');
                let password = req.get('password');
                let hash = bcrypt.hashSync(password, 10);
                let prep = c.prepare('INSERT INTO user (pseudo, email, password) VALUES (:pseudo, :email, :password)');
                c.query(prep({
                    pseudo: pseudo,
                    email: email,
                    password: hash
                }), function (err, rows) {
                    if (err) {
                        throw err;
                    } else {
                        resp.status(201).send('created');
                    }
                })
            } else {
                resp.status(401).send('user already existing');
            }
        })

    } else {
        resp.status(400).send();
    }
});

//-----------------------------------------------------------CONNECT USER-------------------------------------------------------------
app.post("/handbook/user/connect", function (req, resp) {
    let prep = c.prepare("SELECT * FROM user WHERE pseudo = :pseudo OR email = :email")
    c.query(prep({
        pseudo: req.get('pseudo'),
        email: req.get('email')
    }), function (err, rows) {
        if (err) {
            throw err;
        } else if (rows.length > 0) {
            if (passwordchecker(req.get('password'), rows[0].password) === true) {
                if (rows[0].pseudo === "seb") {
                    req.session.admin = true;
                }
                req.session.connected = true;
                req.session.pseudo = rows[0].pseudo;
                resp.status(200).send('ok');
            } else {
                resp.status(401).send('wrong username or password');
            }

        } else {
            resp.send('user not found');
        }
    });
});

//-----------------------------------------------------------DISCONNECT USER-------------------------------------------------------------
app.post("/handbook/user/disconnect", function (req, resp) {
    if (req.session.connected) {
        req.session.connected = false;
    }
    resp.status(200).send("Disconnected");
});

//-----------------------------------------------------------LIST ALL ARTICLES-------------------------------------------------------------
app.get("/handbook/article/all", function (req, resp) {
    c.query("SELECT * FROM article", function (err, rows) {
        if (err) {
            throw err;
        } else {
            resp.send(rows);
        }
    });
});

//-----------------------------------------------------------LIST ONE ARTICLE-------------------------------------------------------------
app.get("/handbook/article/:id", function (req, resp) {
    let prep = c.prepare("SELECT * FROM article WHERE id = :id")
    c.query(prep({
        id: req.params.id,
    }), function (err, rows) {
        if (err) {
            throw err;
        } else {
            resp.status(200).send(rows);
        }
    });
});

//-----------------------------------------------------------ADD ARTICLE-------------------------------------------------------------
app.post("/handbook/article/new", function (req, resp) {
    if (req.session.connected === true) {
        let prep = c.prepare("INSERT INTO article (title, content, author) VALUES (:title, :content, :author)");
        c.query(prep({
            title: req.body.title,
            content: req.body.content,
            author: req.session.pseudo
        }), function (err, rows) {
            if (err) {
                throw err;
            } else {
                resp.send({
                    title: req.body.title,
                    content: req.body.content,
                    author: req.session.pseudo
                });
            }
        });
    } else {
        resp.status(401).send("You must be connected");
    }
});

//-----------------------------------------------------------DELETE ARTICLE-------------------------------------------------------------
app.post("/handbook/article/delete/:id", function (req, resp) {
    author_check(req.params.id).then(function(author){
        if (req.session.connected === true && req.session.pseudo === author || req.session.admin === true) {
            let prep = c.prepare("DELETE FROM article WHERE id = :id");
            c.query(prep({
                id: req.params.id,
            }), function (err, rows) {
                if (err) {
                    throw err;
                } else {
                    resp.status(200).send("deleted");
                }
            });
        } else {
            resp.status(401).send("You must be connected");
        }
    });
});

//-----------------------------------------------------------UPDATE ARTICLE-------------------------------------------------------------
app.put("/handbook/article/update/:id", function (req, resp) {
    author_check(req.params.id).then(function(author){
        if (req.session.connected === true && req.session.pseudo === author || req.session.admin === true) {
            let prep = c.prepare("UPDATE article SET title = :title, content = :content WHERE id= :id");
            c.query(prep({
                title: req.body.title,
                content: req.body.title,
                id:req.params.id
            }), function (err, rows) {
                if (err) {
                    throw err;
                } else {
                    resp.status(200).send("updated");
                }
            });
        } else {
            resp.status(401).send("You must be connected");
        }
    });
});

//-----------------------------------------------------------LIST ALL CATEGORIES-------------------------------------------------------------
app.get("/handbook/category/all", function (req, resp) {
    c.query("SELECT * FROM category", function (err, rows) {
        if (err) {
            throw err;
        } else {
            resp.send(rows);
        }
    });
});

//-----------------------------------------------------------ADD CATEGORY-------------------------------------------------------------
app.post("/handbook/category/new/:category", function (req, resp) {
    if (req.session.admin === true) {
        let prep = c.prepare("INSERT INTO category (category_name) VALUES (:category)");
        c.query(prep({
            category: req.params.category,
        }), function (err, rows) {
            if (err) {
                resp.status(400).send(req.params.category);
            } else {
                resp.send("category added");
            }
        });
    } else {
        resp.status(401).send("You must be connected");
    }
});



app.listen(3000, function () {
    console.log('Listening on port 3000');
});








function registration_check(pseudo, password, email) {
    if (pseudo.length > 2 && pseudo.length < 21 && password.length > 7 && password.length < 400 && email.length < 101) {
        return true;
    } else {
        return false;
    }
}

function registration_check_two(email, pseudo) {
    return new Promise(function (resolve, reject) {
        let prep = c.prepare("SELECT * FROM user WHERE pseudo = :pseudo OR email = :email")
        c.query(prep({
            pseudo: pseudo,
            email: email
        }), function (err, rows) {
            if (err) {
                throw err;
            } else if (rows.length === 0) {
                resolve(true)

            } else {
                resolve(false);
            }
        });
    });
}

function passwordchecker(password, hash) {
    let result = bcrypt.compareSync(password, hash);
    return result;
}

function author_check(id) {
    return new Promise(function (resolve, reject) {
        let prep = c.prepare("SELECT * FROM article WHERE id = :id")
        c.query(prep({
            id: id
        }), function (err, rows) {
            if (err) {
                throw err;
            }
            resolve(rows[0].author);
        });
    });
}
