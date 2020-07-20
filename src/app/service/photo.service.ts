import { Injectable } from '@angular/core';
import {Plugins, CameraResultType, Capacitor, FilesystemDirectory,
        CameraPhoto, CameraSource} from '@capacitor/core';
import { toBase64String } from '@angular/compiler/src/output/source_map';
import { Platform } from '@ionic/angular';
import { stringify } from 'querystring';
      
      
      const{ Camera, Filesystem, Storage } = Plugins; 

@Injectable({
  providedIn: 'root',
  
})

export class PhotoService {
  public photos : Photo[] = [];
  private PHOTO_STORAGE : string = "photos";
  private platform: Platform;

  constructor(platfrom: Platform) {
    this.platform = platfrom;
   }

  public async addNewToGallery(){
    //para tomar la foto
     const capturedPhoto = await Camera.getPhoto({
     resultType: CameraResultType.Uri,
     source: CameraSource.Camera,
     quality: 100 
   });

  this.photos.unshift({
     filepath : "soon...",
     webviewPath: capturedPhoto.webPath
   });

   const savedImageFile = await this.savePicture(capturedPhoto);
   this.photos.unshift(savedImageFile);

   Storage.set({
     key: this.PHOTO_STORAGE,
     value: this.platform.is('hybrid')
      ? JSON.stringify(this.photos)
      : JSON.stringify(this.photos.map(p => {
       // no se guarda la representacion base 64 de los datos de la foto
       // porque ahora se guarda en el sistema de archivos
       const photoCopy = {...p};
       delete photoCopy.base64;

       return photoCopy;
      }))
    }); 
  }

  public async loadSaved(){
    // recupera los datos de la matriz de fotos en caché
    const photos = await Storage.get({ key: this.PHOTO_STORAGE});
    this.photos = JSON.parse(photos.value) || [];

    //Para detectar cuando se ejecuta en la web y la plataforma no es hibrida
    if (!this.platform.is('hybrid')){
      //desplega la foto leyendo en formato base64
      for(let photo of this.photos){
        // lee cada foto guardada desde el Filesystem
        const readFile = await Filesystem.readFile({
          path: photo.filepath,
          directory: FilesystemDirectory.Data
        });
        // Solo para plataforma web: Guarda la foto en el archivo base 64

        photo.base64 = 'data:image/jpeg;base64,${readFile.data}';
      }
    }
  }

  //guarda la imagen en archivo en el dispositivo
  private async savePicture(CameraPhoto: CameraPhoto){
    //Convertir foto a formato base64, requerido por la API del sistema de archivos para guargar
    const base64Data = await this.readAsBase64(CameraPhoto);
    
    //Escribe el archivo al directorio de datos
    const fileName = new Date().getTime() + '.jpeg';
    const savedFile =  await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: FilesystemDirectory.Data
    });
  if(this.platform.is('hybrid')){
    //muestra la nueva imagen reescribiendo la ruta 'file://'a HTTP
    return{
      filepath: savedFile.uri,
      webviewPath: Capacitor.convertFileSrc(savedFile.uri),
    };
  }
  else{
    return{
      filepath: fileName,
      webviewPath: CameraPhoto.webPath
    };
  }
 }

 private async readAsBase64(CameraPhoto: CameraPhoto){
   // es hibrido cuando detecta Cordova o Capacitor
   if(this.platform.is('hybrid')){
     //lee el archivo en formato base64
       const file = await Filesystem.readFile({
       path: CameraPhoto.path
     });
     return file.data;
   }
   else{
     //va a buscar la foto, lee el blob y luego lo convierte en formato base64
     const response = await fetch(CameraPhoto.webPath);
     const blob = await response.blob();
     
     return await this.convertBlobToBase64(blob) as string;

   }
 }

 public async deletePicture(photo: Photo, position: number){
   //elimina la foto desde la matriz de datos de refencia de foto
   this.photos.slice(position, 1);

   //se actualiza la cache de la matriz de fotos sobreescribiendo la matriz de fotos existente
   Storage.set({
     key: this.PHOTO_STORAGE,
     value: JSON.stringify(this.photos)
   });

   //borra la foto desde el dilesystem
   const filename = photo.filepath
                         .substr(photo.filepath.lastIndexOf('/')+1);
    await Filesystem.deleteFile({
      path: filename,
      directory: FilesystemDirectory.Data
    });
 }

 convertBlobToBase64 = (blob : Blob) => new Promise((resolve, reject) =>{
   const reader = new FileReader;
   reader.onerror = reject;
   reader.onload = () => {
     resolve(reader.result);
   };
   reader.readAsDataURL(blob);
 })
}

interface Photo{
  filepath : string;
  webviewPath: string;
  base64? : string;
}

