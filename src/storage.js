let promise;
function database() {
  return promise ??= new Promise((resolve,reject)=>{
    const request=indexedDB.open('ride-atlas',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('rides',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>{promise=null;reject(request.error);};
  });
}
async function operation(mode,callback) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('rides',mode), request=callback(tx.objectStore('rides'));
    tx.oncomplete=()=>resolve(request.result);
    tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error||Error('保存が中断されました'));
  });
}
export const saveRide=ride=>operation('readwrite',store=>store.put(ride));
export const listRides=()=>operation('readonly',store=>store.getAll());
export const deleteRide=id=>operation('readwrite',store=>store.delete(id));
