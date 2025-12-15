// This file is auto-generated from JSON schemas.
// Do not edit manually. Run 'bun run generate:messages' to regenerate.

import { z } from "zod";

export enum Topic {
  FileUploaded = "FileUploaded",
  FileVerified = "FileVerified",
  FileConverted = "FileConverted",
}

export const fileconvertedmessageSchema = z.object({ "fileId": z.string().uuid().describe("Unique identifier for the converted file"), "fileName": z.string().describe("Name of the converted file"), "contentType": z.string().describe("MIME content type of the converted file"), "bucketName": z.string().describe("Name of the storage bucket"), "objectKey": z.string().describe("Object key/path in the storage bucket"), "sizeBytes": z.number().int().describe("Size of the converted file in bytes"), "convertedAt": z.string().datetime({ offset: true }).describe("Timestamp when the file was converted") }).strict()
export type FileconvertedmessageSchema = z.infer<typeof fileconvertedmessageSchema>

export const fileverifiedmessageSchema = z.object({ "fileId": z.string().uuid().describe("Unique identifier for the verified file"), "fileName": z.string().describe("Original name of the file"), "contentType": z.string().describe("MIME content type of the file"), "bucketName": z.string().describe("Name of the storage bucket"), "objectKey": z.string().describe("Object key/path in the storage bucket"), "sizeBytes": z.number().int().describe("Size of the file in bytes"), "uploadedAt": z.string().datetime({ offset: true }).describe("Timestamp when the file was uploaded") }).strict()
export type FileverifiedmessageSchema = z.infer<typeof fileverifiedmessageSchema>

export const fileuploadedmessageSchema = z.object({ "fileId": z.string().uuid().describe("Unique identifier for the uploaded file"), "fileName": z.string().describe("Original name of the uploaded file"), "contentType": z.string().describe("MIME content type of the file"), "bucketName": z.string().describe("Name of the storage bucket"), "objectKey": z.string().describe("Object key/path in the storage bucket"), "sizeBytes": z.number().int().describe("Size of the file in bytes"), "uploadedAt": z.string().datetime({ offset: true }).describe("Timestamp when the file was uploaded") }).strict()
export type FileuploadedmessageSchema = z.infer<typeof fileuploadedmessageSchema>

// Inferred TypeScript types
export type FileConvertedMessage = z.infer<typeof fileconvertedmessageSchema>;
export type FileVerifiedMessage = z.infer<typeof fileverifiedmessageSchema>;
export type FileUploadedMessage = z.infer<typeof fileuploadedmessageSchema>;
