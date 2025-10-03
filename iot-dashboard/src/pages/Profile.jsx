import { FaEnvelope, FaPhone, FaGithub, FaFilePdf, FaBook } from 'react-icons/fa';
import './Profile.css';

const Profile = () => {
  return (
    <div className="profile">
      <div className="profile-card">
        <div className="profile-avatar">
          <div className="avatar-circle">
            {/* Placeholder cho avatar */}
            <div className="avatar-placeholder"></div>
          </div>
        </div>

        <h2 className="profile-name">Lâm Thành Đức</h2>
        <p className="profile-id">MSV:B22DCCN227 | D22HTTT06</p>

        <div className="profile-links">
          <a href="mailto:DucLT.B22CN227@stu.ptit.edu.vn" className="profile-link">
            <FaEnvelope className="link-icon" />
            <span>DucLT.B22CN227@stu.ptit.edu.vn</span>
          </a>

          <a href="tel:0386275204" className="profile-link">
            <FaPhone className="link-icon" />
            <span>0386275204</span>
          </a>

          <a href="https://github.com/LamThanhDuc" target="_blank" rel="noopener noreferrer" className="profile-link">
            <FaGithub className="link-icon" />
            <span>Lam Thanh Duc</span>
          </a>

          <a href="#" className="profile-link">
            <FaFilePdf className="link-icon" />
            <span>Download PDF</span>
          </a>

          <a href="#" className="profile-link">
            <FaBook className="link-icon" />
            <span>API Documentation</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Profile;

