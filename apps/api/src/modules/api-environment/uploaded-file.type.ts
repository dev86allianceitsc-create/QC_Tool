// Minimal local shape for the multer file object passed to @UploadedFile().
// No @types/multer is installed in this workspace (multer itself is only a
// transitive dependency of @nestjs/platform-express), so the global
// Express.Multer.File type is not available — this covers the subset of
// fields actually used here.
export interface UploadedMulterFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}
