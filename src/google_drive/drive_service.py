from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

class GoogleDriveService:
    def __init__(self, credentials):
        self.credentials = credentials
        self.service = build('drive', 'v3', credentials=credentials)

    def create_root_folder(self, professor_email):
        """Create root folder for professor"""
        try:
            folder_metadata = {
                'name': f'Course_QA_System_{professor_email}',
                'mimeType': 'application/vnd.google-apps.folder'
            }
            
            file = self.service.files().create(
                body=folder_metadata,
                fields='id'
            ).execute()
            
            return file.get('id')
        except HttpError as error:
            print(f'An error occurred: {error}')
            return None

    def verify_connection(self):
        """Verify Drive connection is working"""
        try:
            # Try to list files (limit to 1) to verify connection
            self.service.files().list(pageSize=1).execute()
            return True
        except HttpError:
            return False