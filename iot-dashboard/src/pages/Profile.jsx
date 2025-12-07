import { FaEnvelope, FaPhone, FaGithub, FaFilePdf, FaBook } from 'react-icons/fa';
import './Profile.css';

const Profile = () => {
  return (
    <div className="profile">
      <div className="profile-card">
        <div className="profile-avatar">
          <div className="avatar-circle">
            <img 
              src="/Anhthe.jpg" 
              alt="Lâm Thành Đức" 
              className="avatar-image"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="avatar-placeholder" style={{ display: 'none' }}></div>
          </div>
        </div>

        <h2 className="profile-name">Lâm Thành Đức</h2>
        <p className="profile-id">MSV:B22DCCN227 | D22HTTT06</p>

        <div className="profile-links">
          <div className="profile-link profile-info">
            <FaEnvelope className="link-icon" />
            <span>DucLT.B22CN227@stu.ptit.edu.vn</span>
          </div>

          <div className="profile-link profile-info">
            <FaPhone className="link-icon" />
            <span>0386275204</span>
          </div>

          <a href="https://github.com/lamthanhduc2004/IoT-Cam-bien-moi-truong" target="_blank" rel="noopener noreferrer" className="profile-link">
            <FaGithub className="link-icon" />
            <span>Lam Thanh Duc</span>
          </a>

          <a href="/IOT_LamThanhDuc_B22DCCN227.pdf" 
             download="IOT_LamThanhDuc_B22DCCN227.pdf" className="profile-link">
            <FaFilePdf className="link-icon" />
            <span>Download PDF</span>
          </a>

          <a href="https://documenter.getpostman.com/view/42122897/2sB3QNr96U" 
             target="_blank" rel="noopener noreferrer" className="profile-link">
            <FaBook className="link-icon" />
            <span>API Documentation</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default Profile;

