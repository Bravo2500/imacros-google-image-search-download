{
  const Module = {
    settings: {
      folder        : "C:\\test\\",
      limit         : 10000000,
      //isAddTimeStamp: true,
      //isClearCache  : true,
    },

    database: {
      dbObj      : null,
      //transaction: null,
      //objStore   : null,
    },

    img: {
      elms     : null,
      counter  : 0,
      container: (_ => {
        const cont = window.content.document.createElement("div");
        cont.style.display = "none";
        window.content.document.body.appendChild(cont);
        return cont;
      })(),
    },

    createImg: idNum => {
      const img = window.content.document.createElement("img");
      img.id  = "dff32jfljlasasc23" + idNum;
      Module.img.container.appendChild(img);
      return img;
    },

    main: _ => {
      //サムネイル（a要素）の集合　classで特定
      Module.img.elms = window.content.document.querySelectorAll("a.rg_l");

      //要素集合を取得して数が増えていない場合も終了
      if(Module.img.counter === Module.img.elms.length) {
        return;
      }

      let timer = window.setTimeout(function getImage() {
        if(Module.img.counter === Module.settings.limit) {  //回数がlimitに達した時点で終了
          return;
        }
        //サムネイルのa要素から画像のURLを抜き出しデコードする
        const imgurl = decodeURIComponent(Module.img.elms[Module.img.counter].href.match(/\?imgurl=(.+)&imgrefurl/)[1]);

        const transaction = Module.database.dbObj.transaction(["urldb"], "readonly");
        const objStore    = transaction.objectStore("urldb");

        const promise = new Promise((resolve, reject) => {
          //Phase 1: imgurlが存在するかチェック
          const getReq = objStore.get(imgurl);

          getReq.onsuccess = e => {
            if(e.target.result === undefined) {
              //存在しない場合のみresolve
              resolve();
            } else {
              reject("This url is already exist.");
            }
          };

          getReq.onerror = e => {
            reject(e);
          };
        }).then(_ => {
          //Phase 2: 画像を読み込み
          window.content.console.log("save phase: " + imgurl);

          const img = Module.createImg(Module.img.counter);

          return new Promise((resolve, reject) => {
            img.addEventListener("load", e => {
              resolve(img);
            }, false);

            img.addEventListener("error", e => {
              reject(img);
            }, false);

            img.src = imgurl;
          });
        }, error => {
          window.content.console.log(error);
        }).then(img => {
          //Phase 3: 画像の保存

          //img要素に画像のダウンロード完了後が完了次第、指定したフォルダに保存
          iimPlay(`CODE:
            ONDOWNLOAD FOLDER=${Module.settings.folder} FILE=+{{!NOW:_yyyymmddhhnnss}} WAIT=YES
            TAG POS=1 TYPE=IMG ATTR=ID:${img.id} CONTENT=EVENT:SAVEITEM
          `);
          //Notice: ONDOWNLOADは行を分けると効果が失われる（1つのCODE内で同時に読ませる必要有り）
          //Notice: フォルダが無い場合は自動生成される（iMacrosの挙動）

          //保存が終わったら捨てる
          Module.img.container.removeChild(img);

          const putTr = Module.database.dbObj.transaction(["urldb"], "readwrite");
          const putSt = putTr.objectStore("urldb");
          putSt.put({
            url: imgurl,
          });
        }, img => {
          Module.img.container.removeChild(img);
        });

        Module.img.elms[Module.img.counter].parentNode.removeChild(Module.img.elms[Module.img.counter]);

        if(Module.img.counter < Module.img.elms.length) {
          Module.img.counter++;
          timer = window.setTimeout(getImage, 500);
        }
      }, 500);
    },

    init: _ => {
      return new Promise((resolve, reject) => {
        const req = window.content.indexedDB.open("DownloadImagesURL");

        req.onsuccess = e => {
          Module.database.dbObj = e.target.result;
          resolve();
        };

        req.onerror = e => {
          window.content.console.log("error: ", e);
          reject();
        };

        req.onupgradeneeded = e => {
          Module.database.dbObj = e.target.result;

          if(Module.database.dbObj.objectStoreNames.contains("urldb")) {
            Module.database.dbObj.deleteObjectStore("urldb");
          }

          const store = Module.database.dbObj.createObjectStore("urldb", {
            keyPath: "url",
            autoIncrement: false
          });

          window.content.console.log("store created: ", store);
          resolve();
        };
      });
    }
  };

  Module.init().then(_ => {
    window.content.console.log("completed init");
    Module.main();
  }, _ => {
    window.content.console.log("failed init");
  });
}
