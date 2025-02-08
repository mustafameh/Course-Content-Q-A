# src/google_drive/drive_service.py

from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaFileUpload
from googleapiclient.errors import HttpError
from datetime import datetime
import io
import json
import mimetypes
from typing import Tuple, List, Dict, Any, Optional
from googleapiclient.http import MediaIoBaseDownload

class GoogleDriveService:
    """Service class for Google Drive operations"""
    
    def __init__(self, credentials):
        """Initialize the Drive service with credentials"""
        self.credentials = credentials
        self.service = build('drive', 'v3', credentials=credentials)

    def create_subject_folder(self, root_folder_id: str, subject_name: str) -> Optional[str]:
        """
        Create a subject folder in Drive
        
        Args:
            root_folder_id: ID of the root folder
            subject_name: Name of the subject
            
        Returns:
            str: Folder ID if successful, None otherwise
        """
        try:
            folder_metadata = {
                'name': f'Subject_{subject_name}',
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [root_folder_id]
            }
            
            folder = self.service.files().create(
                body=folder_metadata,
                fields='id',
                supportsAllDrives=True
            ).execute()
            
            return folder.get('id')
            
        except HttpError as error:
            print(f'Error creating subject folder: {error}')
            return None

    def upload_file(self, file, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Upload a file to Drive
        
        Args:
            file: File object from request
            metadata: File metadata including name and parent folder
            
        Returns:
            dict: Uploaded file information
        """
        try:
            # Create file stream
            file_stream = io.BytesIO(file.read())
            
            # Create media upload object
            media = MediaIoBaseUpload(
                file_stream,
                mimetype=metadata.get('mimeType', 'application/octet-stream'),
                resumable=True
            )
            
            # Upload file
            file = self.service.files().create(
                body=metadata,
                media_body=media,
                fields='id, name, mimeType, size, modifiedTime',
                supportsAllDrives=True
            ).execute()
            
            return file
            
        except HttpError as error:
            print(f'Error uploading file: {error}')
            raise
        
    def delete_folder(self, folder_id: str) -> bool:
        """
        Delete a folder and all its contents from Drive
        
        Args:
            folder_id: Drive folder ID
            
        Returns:
            bool: True if successful
        """
        try:
            # First, recursively delete all contents
            files = self.list_folder_files(folder_id)[0]  # Get first element of tuple (files list)
            
            # Delete all files in the folder
            for file in files:
                try:
                    self.delete_file(file['id'])
                except Exception as e:
                    print(f"Error deleting file {file['name']}: {str(e)}")
            
            # Finally delete the folder itself
            self.service.files().delete(
                fileId=folder_id,
                supportsAllDrives=True
            ).execute()
            
            return True
            
        except HttpError as error:
            print(f'Error deleting folder: {error}')
            raise

    def list_folder_files(
        self, 
        folder_id: str, 
        search_term: str = '', 
        page: int = 1, 
        page_size: int = 10
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        List files in a folder with pagination and search
        
        Args:
            folder_id: Drive folder ID
            search_term: Optional search term
            page: Page number
            page_size: Items per page
            
        Returns:
            tuple: (list of files, total count)
        """
        try:
            # Build query
            query = f"'{folder_id}' in parents and trashed = false"
            if search_term:
                query += f" and name contains '{search_term}'"
            
            # Get total count
            total_files = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id)',
                supportsAllDrives=True
            ).execute()
            total_count = len(total_files.get('files', []))
            
            # Get paginated results
            skip = (page - 1) * page_size
            results = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name, mimeType, size, modifiedTime, thumbnailLink)',
                orderBy='modifiedTime desc',
                pageSize=page_size,
                pageToken=None if page == 1 else self._get_page_token(skip),
                supportsAllDrives=True
            ).execute()
            
            files = results.get('files', [])
            
            # Process files
            processed_files = []
            for file in files:
                processed_files.append({
                    'id': file.get('id'),
                    'name': file.get('name'),
                    'mimeType': file.get('mimeType'),
                    'size': int(file.get('size', 0)),
                    'modifiedTime': file.get('modifiedTime'),
                    'thumbnailLink': file.get('thumbnailLink')
                })
            
            return processed_files, total_count
            
        except HttpError as error:
            print(f'Error listing files: {error}')
            raise

    def get_file_info(self, file_id: str) -> Dict[str, Any]:
        """
        Get detailed file information
        
        Args:
            file_id: Drive file ID
            
        Returns:
            dict: File information
        """
        try:
            file = self.service.files().get(
                fileId=file_id,
                fields='id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink',
                supportsAllDrives=True
            ).execute()
            
            return file
            
        except HttpError as error:
            print(f'Error getting file info: {error}')
            raise

    def get_preview_url(self, file_id: str) -> str:
        """
        Get preview URL for a file
        
        Args:
            file_id: Drive file ID
            
        Returns:
            str: Preview URL
        """
        try:
            file = self.service.files().get(
                fileId=file_id,
                fields='webViewLink',
                supportsAllDrives=True
            ).execute()
            
            return file.get('webViewLink', '')
            
        except HttpError as error:
            print(f'Error getting preview URL: {error}')
            raise

    def delete_file(self, file_id: str) -> bool:
        """
        Delete a file from Drive
        
        Args:
            file_id: Drive file ID
            
        Returns:
            bool: True if successful
        """
        try:
            self.service.files().delete(
                fileId=file_id,
                supportsAllDrives=True
            ).execute()
            return True
            
        except HttpError as error:
            print(f'Error deleting file: {error}')
            raise

    def sync_folder(self, folder_id: str) -> bool:
        """
        Sync folder contents (refresh metadata)
        
        Args:
            folder_id: Drive folder ID
            
        Returns:
            bool: True if successful
        """
        try:
            # List all files to refresh metadata
            self.service.files().list(
                q=f"'{folder_id}' in parents",
                spaces='drive',
                fields='files(id, name, mimeType, size, modifiedTime)',
                supportsAllDrives=True
            ).execute()
            
            return True
            
        except HttpError as error:
            print(f'Error syncing folder: {error}')
            raise

    def verify_connection(self) -> bool:
        """
        Verify Drive connection is working
        
        Returns:
            bool: True if connected
        """
        try:
            self.service.files().list(pageSize=1).execute()
            return True
        except HttpError:
            return False

    def _get_page_token(self, skip: int) -> Optional[str]:
        """
        Get page token for pagination
        
        Args:
            skip: Number of items to skip
            
        Returns:
            str: Page token
        """
        if skip == 0:
            return None
            
        try:
            result = self.service.files().list(
                pageSize=skip,
                fields='nextPageToken'
            ).execute()
            
            return result.get('nextPageToken')
            
        except HttpError:
            return None

    def check_file_permissions(self, file_id: str) -> bool:
        """
        Check if current user has access to file
        
        Args:
            file_id: Drive file ID
            
        Returns:
            bool: True if has access
        """
        try:
            self.service.files().get(
                fileId=file_id,
                fields='id',
                supportsAllDrives=True
            ).execute()
            return True
        except HttpError:
            return False
        
    def download_file(self, file_id: str, destination_path: str):
        """Download a file from Drive to local path"""
        try:
            request = self.service.files().get_media(fileId=file_id)
            with open(destination_path, 'wb') as f:
                downloader = MediaIoBaseDownload(f, request)
                done = False
                while done is False:
                    status, done = downloader.next_chunk()
                    
        except HttpError as error:
            print(f'Error downloading file: {error}')
            raise

    def update_file_metadata(self, file_id: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update file metadata (name, description, etc.)
        
        Args:
            file_id: Drive file ID
            metadata: New metadata
            
        Returns:
            dict: Updated file information
        """
        try:
            updated_file = self.service.files().update(
                fileId=file_id,
                body=metadata,
                fields='id, name, mimeType, size, modifiedTime',
                supportsAllDrives=True
            ).execute()
            
            return updated_file
            
        except HttpError as error:
            print(f'Error updating file metadata: {error}')
            raise
    
    def create_root_folder(self, professor_email: str) -> str:
        """Create root folder for professor in Drive"""
        try:
            folder_metadata = {
                'name': f'Course_Content_QA_{professor_email}',
                'mimeType': 'application/vnd.google-apps.folder'
            }
            
            folder = self.service.files().create(
                body=folder_metadata,
                fields='id',
                supportsAllDrives=True
            ).execute()
            
            return folder.get('id')
            
        except HttpError as error:
            print(f'Error creating root folder: {error}')
            return None
        
    def update_folder_name(self, folder_id: str, new_name: str) -> bool:
        """Update folder name in Drive"""
        try:
            file_metadata = {'name': new_name}
            
            self.service.files().update(
                fileId=folder_id,
                body=file_metadata,
                fields='id, name',
                supportsAllDrives=True
            ).execute()
            
            return True
            
        except HttpError as error:
            print(f'Error updating folder name: {error}')
            raise
    
    def rename_file(self, file_id, new_name):
        """Rename a file in Google Drive"""
        try:
            file_metadata = {'name': new_name}
            updated_file = self.service.files().update(
                fileId=file_id,
                body=file_metadata,
                fields='id, name, mimeType, modifiedTime'
            ).execute()
            return updated_file
        except Exception as e:
            print(f"Error renaming file in Drive: {str(e)}")
            raise
        
    def create_faq_file(self, folder_id: str) -> str:
        """Create FAQ CSV file in the subject folder"""
        try:
            # Create CSV content with headers
            csv_content = "number,question,answer,date_asked,date_answered\n"
            
            # Create file metadata
            file_metadata = {
                'name': 'faq.csv',
                'parents': [folder_id],
                'mimeType': 'text/csv'
            }
            
            # Create file stream
            file_stream = io.BytesIO(csv_content.encode('utf-8'))
            
            # Upload file
            media = MediaIoBaseUpload(
                file_stream,
                mimetype='text/csv',
                resumable=True
            )
            
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id',
                supportsAllDrives=True
            ).execute()
            
            return file.get('id')
            
        except HttpError as error:
            print(f'Error creating FAQ file: {error}')
            raise

    def update_faq_file(self, file_id: str, new_question: str):
        """Prepend a new question to the FAQ file"""
        try:
            # Download current content
            request = self.service.files().get_media(fileId=file_id)
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
                
            # Get current content and decode
            content = fh.getvalue().decode('utf-8')
            
            # Split into lines
            lines = content.split('\n')
            headers = lines[0]
            existing_entries = lines[1:] if len(lines) > 1 else []
            
            # Get next number
            next_number = 1
            if existing_entries and existing_entries[0].strip():
                try:
                    next_number = int(existing_entries[0].split(',')[0]) + 1
                except (IndexError, ValueError):
                    pass
            
            # Create new entry
            from datetime import datetime
            current_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            new_entry = f'{next_number},{new_question},,{current_date},'
            
            # Combine content
            new_content = headers + '\n' + new_entry + '\n' + '\n'.join(filter(None, existing_entries))
            
            # Upload updated content
            file_stream = io.BytesIO(new_content.encode('utf-8'))
            media = MediaIoBaseUpload(
                file_stream,
                mimetype='text/csv',
                resumable=True
            )
            
            self.service.files().update(
                fileId=file_id,
                media_body=media,
                supportsAllDrives=True
            ).execute()
            
        except HttpError as error:
            print(f'Error updating FAQ file: {error}')
            raise
            
            
        
                