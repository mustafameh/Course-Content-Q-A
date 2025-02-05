import os
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'


from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from flask import url_for, current_app
import json


class GoogleDriveAuth:
    def __init__(self):
        self.SCOPES = [
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'openid'
        ]
        self.credentials_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            'config',
            'google_credentials.json'
        )

    def create_auth_flow(self, redirect_uri=None):
        """Create OAuth2 flow instance"""
        flow = Flow.from_client_secrets_file(
            self.credentials_file,
            scopes=self.SCOPES,
            redirect_uri=redirect_uri
        )
        return flow

    def get_authorization_url(self):
        """Generate authorization URL for Google OAuth"""
        """Generate authorization URL for Google OAuth"""
        redirect_uri = url_for('professor.oauth2callback', _external=True)
        print("Redirect URI:", redirect_uri)  # Add this line
        flow = self.create_auth_flow(
        redirect_uri=redirect_uri
            )
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        return authorization_url, state

    def get_credentials_from_token(self, token_info):
        """Create credentials object from stored token info"""
        if not token_info:
            return None
            
        return Credentials(
            token=token_info.get('token'),
            refresh_token=token_info.get('refresh_token'),
            token_uri=token_info.get('token_uri'),
            client_id=token_info.get('client_id'),
            client_secret=token_info.get('client_secret'),
            scopes=token_info.get('scopes')
        )

    def process_oauth2_callback(self, flow, code):
        """Process OAuth2 callback and return token info"""
        flow.fetch_token(code=code)
        credentials = flow.credentials

        return {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }